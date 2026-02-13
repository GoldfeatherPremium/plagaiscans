import React, { useState } from 'react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Switch } from '@/components/ui/switch';
import { useRemarkPresets, RemarkPreset } from '@/hooks/useRemarkPresets';
import { supabase } from '@/integrations/supabase/client';
import { useToast } from '@/hooks/use-toast';
import { Loader2, Plus, Pencil, Trash2, Save, X, FileText } from 'lucide-react';

export const AdminRemarkPresets: React.FC = () => {
  const { toast } = useToast();
  const { presets, loading, refetch } = useRemarkPresets(false);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [editText, setEditText] = useState('');
  const [newRemark, setNewRemark] = useState('');
  const [adding, setAdding] = useState(false);
  const [toggling, setToggling] = useState<string | null>(null);
  const [deleting, setDeleting] = useState<string | null>(null);
  const [saving, setSaving] = useState<string | null>(null);

  const handleToggle = async (preset: RemarkPreset) => {
    setToggling(preset.id);
    const { error } = await supabase
      .from('remark_presets')
      .update({ is_active: !preset.is_active })
      .eq('id', preset.id);
    
    if (error) {
      toast({ title: 'Error', description: 'Failed to update preset', variant: 'destructive' });
    }
    await refetch();
    setToggling(null);
  };

  const handleStartEdit = (preset: RemarkPreset) => {
    setEditingId(preset.id);
    setEditText(preset.remark_text);
  };

  const handleSaveEdit = async () => {
    if (!editingId || !editText.trim()) return;
    setSaving(editingId);
    const { error } = await supabase
      .from('remark_presets')
      .update({ remark_text: editText.trim() })
      .eq('id', editingId);
    
    if (error) {
      toast({ title: 'Error', description: 'Failed to update remark', variant: 'destructive' });
    } else {
      toast({ title: 'Updated', description: 'Remark text updated' });
    }
    setEditingId(null);
    setSaving(null);
    await refetch();
  };

  const handleDelete = async (id: string) => {
    setDeleting(id);
    const { error } = await supabase
      .from('remark_presets')
      .delete()
      .eq('id', id);
    
    if (error) {
      toast({ title: 'Error', description: 'Failed to delete preset', variant: 'destructive' });
    } else {
      toast({ title: 'Deleted', description: 'Remark preset removed' });
    }
    setDeleting(null);
    await refetch();
  };

  const handleAdd = async () => {
    if (!newRemark.trim()) return;
    setAdding(true);
    const { error } = await supabase
      .from('remark_presets')
      .insert({ 
        remark_text: newRemark.trim(), 
        is_active: true, 
        sort_order: presets.length + 1 
      });
    
    if (error) {
      toast({ title: 'Error', description: 'Failed to add remark', variant: 'destructive' });
    } else {
      toast({ title: 'Added', description: 'New remark preset created' });
      setNewRemark('');
    }
    setAdding(false);
    await refetch();
  };

  const activeCount = presets.filter(p => p.is_active).length;

  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <FileText className="h-5 w-5" />
          Remark Presets
        </CardTitle>
        <CardDescription>
          Manage predefined remarks for staff to select when processing documents. 
          {presets.length > 0 && ` ${activeCount} of ${presets.length} active.`}
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-4">
        {/* Add new remark */}
        <div className="flex gap-2">
          <Input
            placeholder="Add a new remark preset..."
            value={newRemark}
            onChange={(e) => setNewRemark(e.target.value)}
            onKeyDown={(e) => e.key === 'Enter' && handleAdd()}
          />
          <Button onClick={handleAdd} disabled={adding || !newRemark.trim()} size="sm">
            {adding ? <Loader2 className="h-4 w-4 animate-spin" /> : <Plus className="h-4 w-4" />}
          </Button>
        </div>

        {/* Presets list */}
        {loading ? (
          <div className="flex justify-center py-8">
            <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
          </div>
        ) : presets.length === 0 ? (
          <p className="text-sm text-muted-foreground text-center py-4">No remark presets yet. Add one above.</p>
        ) : (
          <div className="space-y-2 max-h-[500px] overflow-y-auto">
            {presets.map((preset) => (
              <div
                key={preset.id}
                className="flex items-center gap-3 p-3 rounded-lg border bg-card hover:bg-muted/50 transition-colors"
              >
                <Switch
                  checked={preset.is_active}
                  onCheckedChange={() => handleToggle(preset)}
                  disabled={toggling === preset.id}
                />
                
                <div className="flex-1 min-w-0">
                  {editingId === preset.id ? (
                    <div className="flex gap-2">
                      <Input
                        value={editText}
                        onChange={(e) => setEditText(e.target.value)}
                        className="text-sm"
                        onKeyDown={(e) => e.key === 'Enter' && handleSaveEdit()}
                        autoFocus
                      />
                      <Button size="sm" variant="ghost" onClick={handleSaveEdit} disabled={saving === preset.id}>
                        {saving === preset.id ? <Loader2 className="h-3 w-3 animate-spin" /> : <Save className="h-3 w-3" />}
                      </Button>
                      <Button size="sm" variant="ghost" onClick={() => setEditingId(null)}>
                        <X className="h-3 w-3" />
                      </Button>
                    </div>
                  ) : (
                    <p className={`text-sm truncate ${!preset.is_active ? 'text-muted-foreground' : ''}`} title={preset.remark_text}>
                      {preset.remark_text}
                    </p>
                  )}
                </div>

                {editingId !== preset.id && (
                  <div className="flex gap-1 shrink-0">
                    <Button size="sm" variant="ghost" onClick={() => handleStartEdit(preset)}>
                      <Pencil className="h-3 w-3" />
                    </Button>
                    <Button
                      size="sm"
                      variant="ghost"
                      className="text-destructive hover:text-destructive"
                      onClick={() => handleDelete(preset.id)}
                      disabled={deleting === preset.id}
                    >
                      {deleting === preset.id ? <Loader2 className="h-3 w-3 animate-spin" /> : <Trash2 className="h-3 w-3" />}
                    </Button>
                  </div>
                )}
              </div>
            ))}
          </div>
        )}
      </CardContent>
    </Card>
  );
};
