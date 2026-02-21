import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

interface CleanupResult {
  documentsProcessed: number;
  filesDeleted: number;
  errors: string[];
  magicUploadsDeleted: number;
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
    const supabaseServiceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
    const supabase = createClient(supabaseUrl, supabaseServiceKey);

    // Parse optional parameters
    const url = new URL(req.url);
    const retentionDays = parseInt(url.searchParams.get("days") || "10");
    const batchSize = parseInt(url.searchParams.get("batch") || "50");
    const dryRun = url.searchParams.get("dry_run") === "true";

    console.log(`Starting cleanup: retention=${retentionDays} days, batch=${batchSize}, dryRun=${dryRun}`);

    const result: CleanupResult = {
      documentsProcessed: 0,
      filesDeleted: 0,
      errors: [],
      magicUploadsDeleted: 0,
    };

    // Calculate cutoff date
    const cutoffDate = new Date();
    cutoffDate.setDate(cutoffDate.getDate() - retentionDays);
    const cutoffISO = cutoffDate.toISOString();

    console.log(`Cutoff date: ${cutoffISO}`);

    // Find documents older than retention period that haven't been cleaned
    const { data: documents, error: fetchError } = await supabase
      .from("documents")
      .select("id, file_path, similarity_report_path, ai_report_path, scan_type")
      .lt("uploaded_at", cutoffISO)
      .is("files_cleaned_at", null)
      .or("file_path.neq.null,similarity_report_path.neq.null,ai_report_path.neq.null")
      .limit(batchSize);

    if (fetchError) {
      throw new Error(`Failed to fetch documents: ${fetchError.message}`);
    }

    console.log(`Found ${documents?.length || 0} documents to clean`);

    // Process each document
    for (const doc of documents || []) {
      const filesToDelete: { bucket: string; path: string }[] = [];

      // Original document file
      if (doc.file_path) {
        filesToDelete.push({ bucket: "documents", path: doc.file_path });
      }

      // Similarity report
      if (doc.similarity_report_path) {
        // Determine which bucket based on scan_type
        const bucket = doc.scan_type === "similarity_only" ? "similarity-reports" : "reports";
        filesToDelete.push({ bucket, path: doc.similarity_report_path });
      }

      // AI report
      if (doc.ai_report_path) {
        filesToDelete.push({ bucket: "reports", path: doc.ai_report_path });
      }

      if (dryRun) {
        console.log(`[DRY RUN] Would delete ${filesToDelete.length} files for document ${doc.id}`);
        result.documentsProcessed++;
        result.filesDeleted += filesToDelete.length;
        continue;
      }

      // Delete files from storage
      for (const file of filesToDelete) {
        try {
          const { error: deleteError } = await supabase.storage
            .from(file.bucket)
            .remove([file.path]);

          if (deleteError) {
            // Log error but continue - file might already be deleted
            console.warn(`Failed to delete ${file.bucket}/${file.path}: ${deleteError.message}`);
          } else {
            result.filesDeleted++;
            console.log(`Deleted: ${file.bucket}/${file.path}`);
          }
        } catch (err) {
          console.warn(`Error deleting file: ${err}`);
        }
      }

      // Update document record - set paths to null and mark as cleaned
      const { error: updateError } = await supabase
        .from("documents")
        .update({
          file_path: null,
          similarity_report_path: null,
          ai_report_path: null,
          files_cleaned_at: new Date().toISOString(),
        })
        .eq("id", doc.id);

      if (updateError) {
        result.errors.push(`Failed to update document ${doc.id}: ${updateError.message}`);
        console.error(`Failed to update document ${doc.id}:`, updateError);
      } else {
        result.documentsProcessed++;
      }
    }

    // Clean magic uploads older than retention period
    const { data: magicFiles, error: magicListError } = await supabase.storage
      .from("magic-uploads")
      .list("", { limit: batchSize });

    if (!magicListError && magicFiles) {
      for (const folder of magicFiles) {
        // Each folder is a magic link ID, check files inside
        const { data: files } = await supabase.storage
          .from("magic-uploads")
          .list(folder.name);

        if (files) {
          for (const file of files) {
            // Check if file is older than retention period
            const fileDate = new Date(file.created_at || file.updated_at || Date.now());
            if (fileDate < cutoffDate) {
              if (!dryRun) {
                const filePath = `${folder.name}/${file.name}`;
                const { error: deleteError } = await supabase.storage
                  .from("magic-uploads")
                  .remove([filePath]);

                if (!deleteError) {
                  result.magicUploadsDeleted++;
                  console.log(`Deleted magic upload: ${filePath}`);
                }
              } else {
                result.magicUploadsDeleted++;
              }
            }
          }
        }
      }
    }

    // Also update magic_upload_files table
    const { error: magicDbError } = await supabase
      .from("magic_upload_files")
      .update({ deleted_at: new Date().toISOString(), deleted_by_user: false })
      .lt("uploaded_at", cutoffISO)
      .is("deleted_at", null);

    if (magicDbError) {
      console.warn(`Failed to update magic_upload_files: ${magicDbError.message}`);
    }

    console.log("Cleanup complete:", result);

    return new Response(
      JSON.stringify({
        success: true,
        dryRun,
        retentionDays,
        ...result,
      }),
      {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      }
    );
  } catch (error: unknown) {
    console.error("Cleanup error:", error);
    const errorMessage = error instanceof Error ? error.message : "Unknown error";
    return new Response(
      JSON.stringify({
        success: false,
        error: errorMessage,
      }),
      {
        status: 500,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      }
    );
  }
});
