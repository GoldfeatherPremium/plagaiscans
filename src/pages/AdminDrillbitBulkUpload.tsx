import { DashboardLayout } from '@/components/DashboardLayout';
import { BulkReportUploadV2Content } from './AdminBulkReportUploadV2';

export default function AdminDrillbitBulkUpload() {
  return (
    <DashboardLayout>
      <div className="space-y-4">
        <h1 className="text-2xl font-bold">Drillbit Bulk Report Upload (AI + Similarity)</h1>
        <BulkReportUploadV2Content provider="drillbit" />
      </div>
    </DashboardLayout>
  );
}
