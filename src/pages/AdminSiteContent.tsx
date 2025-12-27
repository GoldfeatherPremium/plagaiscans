import { useState } from "react";
import { useAdminSiteContent } from "@/hooks/useSiteContent";
import { DashboardLayout } from "@/components/DashboardLayout";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Save, FileText, Loader2, Search, RefreshCw } from "lucide-react";
import { SkeletonCard } from "@/components/ui/skeleton";

const sectionLabels: Record<string, string> = {
  hero: "Hero Section",
  about: "About Section",
  services: "Features Section",
  contact: "Contact Section",
  footer: "Footer",
  navigation: "Navigation",
  seo: "SEO Settings",
  general: "General",
};

const sectionIcons: Record<string, string> = {
  hero: "🚀",
  about: "ℹ️",
  services: "⚡",
  contact: "📧",
  footer: "📄",
  navigation: "🧭",
  seo: "🔍",
  general: "⚙️",
};

const AdminSiteContent = () => {
  const { groupedContent, loading, saving, updateContent, refetch } = useAdminSiteContent();
  const [editedValues, setEditedValues] = useState<Record<string, string>>({});
  const [searchQuery, setSearchQuery] = useState("");

  const handleValueChange = (id: string, value: string) => {
    setEditedValues(prev => ({ ...prev, [id]: value }));
  };

  const handleSave = async (id: string, originalValue: string) => {
    const newValue = editedValues[id];
    if (newValue !== undefined && newValue !== originalValue) {
      await updateContent(id, newValue);
      setEditedValues(prev => {
        const updated = { ...prev };
        delete updated[id];
        return updated;
      });
    }
  };

  const hasChanges = (id: string, originalValue: string) => {
    const editedValue = editedValues[id];
    return editedValue !== undefined && editedValue !== originalValue;
  };

  const sections = Object.keys(groupedContent);

  const filterContent = (items: typeof groupedContent[string]) => {
    if (!searchQuery) return items;
    const query = searchQuery.toLowerCase();
    return items.filter(
      item =>
        item.content_key.toLowerCase().includes(query) ||
        item.content_value.toLowerCase().includes(query) ||
        item.description?.toLowerCase().includes(query)
    );
  };

  if (loading) {
    return (
      <DashboardLayout>
        <div className="space-y-6 page-enter">
          <div className="flex items-center gap-3">
            <div className="w-12 h-12 bg-primary/10 rounded-xl flex items-center justify-center">
              <FileText className="w-6 h-6 text-primary" />
            </div>
            <div>
              <h1 className="text-2xl font-display font-bold">Site Content</h1>
              <p className="text-muted-foreground">Loading content...</p>
            </div>
          </div>
          <div className="grid gap-4">
            <SkeletonCard />
            <SkeletonCard />
          </div>
        </div>
      </DashboardLayout>
    );
  }

  return (
    <DashboardLayout>
      <div className="space-y-6 page-enter">
        {/* Header */}
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
          <div className="flex items-center gap-3">
            <div className="w-12 h-12 bg-primary/10 rounded-xl flex items-center justify-center">
              <FileText className="w-6 h-6 text-primary" />
            </div>
            <div>
              <h1 className="text-2xl font-display font-bold">Site Content</h1>
              <p className="text-muted-foreground">Edit all text content on the website</p>
            </div>
          </div>
          <Button variant="outline" onClick={refetch} disabled={loading}>
            <RefreshCw className={`w-4 h-4 mr-2 ${loading ? 'animate-spin' : ''}`} />
            Refresh
          </Button>
        </div>

        {/* Search */}
        <div className="relative">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
          <Input
            placeholder="Search content..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            className="pl-10"
          />
        </div>

        {/* Content Tabs */}
        <Tabs defaultValue={sections[0] || "hero"} className="space-y-6">
          <TabsList className="flex-wrap h-auto gap-2 bg-transparent p-0">
            {sections.map((section) => (
              <TabsTrigger
                key={section}
                value={section}
                className="data-[state=active]:bg-primary data-[state=active]:text-primary-foreground rounded-full px-4"
              >
                <span className="mr-2">{sectionIcons[section] || "📝"}</span>
                {sectionLabels[section] || section}
                <Badge variant="secondary" className="ml-2 text-xs">
                  {groupedContent[section]?.length || 0}
                </Badge>
              </TabsTrigger>
            ))}
          </TabsList>

          {sections.map((section) => (
            <TabsContent key={section} value={section} className="space-y-4 stagger-children">
              {filterContent(groupedContent[section] || []).map((item) => {
                const currentValue = editedValues[item.id] ?? item.content_value;
                const isMultiline = item.content_value.length > 100 || item.content_value.includes('\n');
                const changed = hasChanges(item.id, item.content_value);

                return (
                  <Card key={item.id} className={`transition-all duration-200 ${changed ? 'ring-2 ring-primary/50' : ''}`}>
                    <CardHeader className="pb-3">
                      <div className="flex items-start justify-between gap-4">
                        <div>
                          <CardTitle className="text-base font-medium flex items-center gap-2">
                            {item.content_key.replace(/_/g, ' ').replace(/\b\w/g, l => l.toUpperCase())}
                            {changed && (
                              <Badge variant="default" className="text-xs">
                                Unsaved
                              </Badge>
                            )}
                          </CardTitle>
                          {item.description && (
                            <p className="text-sm text-muted-foreground mt-1">
                              {item.description}
                            </p>
                          )}
                        </div>
                        <Button
                          size="sm"
                          onClick={() => handleSave(item.id, item.content_value)}
                          disabled={!changed || saving}
                          className="shrink-0"
                        >
                          {saving ? (
                            <Loader2 className="w-4 h-4 animate-spin" />
                          ) : (
                            <>
                              <Save className="w-4 h-4 mr-1" />
                              Save
                            </>
                          )}
                        </Button>
                      </div>
                    </CardHeader>
                    <CardContent>
                      {isMultiline ? (
                        <Textarea
                          value={currentValue}
                          onChange={(e) => handleValueChange(item.id, e.target.value)}
                          className="min-h-[100px] resize-y"
                          placeholder="Enter content..."
                        />
                      ) : (
                        <Input
                          value={currentValue}
                          onChange={(e) => handleValueChange(item.id, e.target.value)}
                          placeholder="Enter content..."
                        />
                      )}
                      <p className="text-xs text-muted-foreground mt-2">
                        Key: <code className="bg-muted px-1 py-0.5 rounded">{item.content_key}</code>
                      </p>
                    </CardContent>
                  </Card>
                );
              })}

              {filterContent(groupedContent[section] || []).length === 0 && (
                <Card>
                  <CardContent className="py-8 text-center text-muted-foreground">
                    No content found matching your search.
                  </CardContent>
                </Card>
              )}
            </TabsContent>
          ))}
        </Tabs>
      </div>
    </DashboardLayout>
  );
};

export default AdminSiteContent;
