import React, { useState, useEffect } from 'react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Badge } from '@/components/ui/badge';
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from '@/components/ui/dialog';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/contexts/AuthContext';
import { useToast } from '@/hooks/use-toast';
import { Tag, Plus, X, Check, Loader2 } from 'lucide-react';
import { cn } from '@/lib/utils';

interface DocumentTag {
  id: string;
  name: string;
  color: string;
  user_id: string;
}

interface DocumentTagManagerProps {
  documentId: string;
  compact?: boolean;
}

const TAG_COLORS = [
  '#ef4444', '#f97316', '#eab308', '#22c55e', '#14b8a6',
  '#06b6d4', '#3b82f6', '#6366f1', '#8b5cf6', '#ec4899',
];

export const DocumentTagManager: React.FC<DocumentTagManagerProps> = ({
  documentId,
  compact = false
}) => {
  const { user } = useAuth();
  const { toast } = useToast();
  const [tags, setTags] = useState<DocumentTag[]>([]);
  const [assignedTagIds, setAssignedTagIds] = useState<Set<string>>(new Set());
  const [loading, setLoading] = useState(true);
  const [newTagName, setNewTagName] = useState('');
  const [selectedColor, setSelectedColor] = useState(TAG_COLORS[0]);
  const [creating, setCreating] = useState(false);
  const [dialogOpen, setDialogOpen] = useState(false);

  useEffect(() => {
    if (user) fetchData();
  }, [user, documentId]);

  const fetchData = async () => {
    if (!user) return;
    
    // Fetch user's tags
    const { data: userTags } = await supabase
      .from('document_tags')
      .select('*')
      .eq('user_id', user.id);
    
    setTags(userTags || []);

    // Fetch assigned tags for this document
    const { data: assignments } = await supabase
      .from('document_tag_assignments')
      .select('tag_id')
      .eq('document_id', documentId);
    
    setAssignedTagIds(new Set((assignments || []).map(a => a.tag_id)));
    setLoading(false);
  };

  const createTag = async () => {
    if (!user || !newTagName.trim()) return;
    
    setCreating(true);
    const { data, error } = await supabase
      .from('document_tags')
      .insert({
        name: newTagName.trim(),
        color: selectedColor,
        user_id: user.id
      })
      .select()
      .single();

    if (error) {
      toast({ title: 'Error', description: 'Failed to create tag', variant: 'destructive' });
    } else if (data) {
      setTags([...tags, data]);
      setNewTagName('');
      toast({ title: 'Tag Created', description: `Tag "${data.name}" created` });
    }
    setCreating(false);
  };

  const toggleTag = async (tagId: string) => {
    const isAssigned = assignedTagIds.has(tagId);
    
    if (isAssigned) {
      // Remove assignment
      await supabase
        .from('document_tag_assignments')
        .delete()
        .eq('document_id', documentId)
        .eq('tag_id', tagId);
      
      setAssignedTagIds(prev => {
        const newSet = new Set(prev);
        newSet.delete(tagId);
        return newSet;
      });
    } else {
      // Add assignment
      await supabase
        .from('document_tag_assignments')
        .insert({ document_id: documentId, tag_id: tagId });
      
      setAssignedTagIds(prev => new Set([...prev, tagId]));
    }
  };

  const deleteTag = async (tagId: string) => {
    await supabase.from('document_tags').delete().eq('id', tagId);
    setTags(tags.filter(t => t.id !== tagId));
    setAssignedTagIds(prev => {
      const newSet = new Set(prev);
      newSet.delete(tagId);
      return newSet;
    });
  };

  const assignedTags = tags.filter(t => assignedTagIds.has(t.id));

  if (loading) {
    return <Loader2 className="h-4 w-4 animate-spin text-muted-foreground" />;
  }

  return (
    <div className="flex items-center gap-1 flex-wrap">
      {/* Display assigned tags */}
      {assignedTags.map(tag => (
        <Badge 
          key={tag.id} 
          variant="outline"
          style={{ borderColor: tag.color, color: tag.color }}
          className="text-xs"
        >
          {tag.name}
        </Badge>
      ))}
      
      {/* Tag manager popover */}
      <Popover>
        <PopoverTrigger asChild>
          <Button variant="ghost" size="sm" className="h-6 w-6 p-0">
            <Tag className="h-3 w-3" />
          </Button>
        </PopoverTrigger>
        <PopoverContent className="w-64 p-2" align="start">
          <div className="space-y-2">
            <p className="text-xs font-medium text-muted-foreground">Manage Tags</p>
            
            {/* Existing tags */}
            <div className="space-y-1 max-h-40 overflow-y-auto">
              {tags.length === 0 ? (
                <p className="text-xs text-muted-foreground py-2 text-center">No tags yet</p>
              ) : (
                tags.map(tag => (
                  <div 
                    key={tag.id} 
                    className={cn(
                      "flex items-center justify-between p-1.5 rounded cursor-pointer hover:bg-muted",
                      assignedTagIds.has(tag.id) && "bg-muted"
                    )}
                    onClick={() => toggleTag(tag.id)}
                  >
                    <div className="flex items-center gap-2">
                      <div 
                        className="h-3 w-3 rounded-full" 
                        style={{ backgroundColor: tag.color }}
                      />
                      <span className="text-sm">{tag.name}</span>
                    </div>
                    <div className="flex items-center gap-1">
                      {assignedTagIds.has(tag.id) && (
                        <Check className="h-3 w-3 text-primary" />
                      )}
                      <Button 
                        variant="ghost" 
                        size="sm" 
                        className="h-5 w-5 p-0 opacity-0 group-hover:opacity-100"
                        onClick={(e) => { e.stopPropagation(); deleteTag(tag.id); }}
                      >
                        <X className="h-3 w-3" />
                      </Button>
                    </div>
                  </div>
                ))
              )}
            </div>
            
            {/* Create new tag */}
            <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
              <DialogTrigger asChild>
                <Button variant="outline" size="sm" className="w-full gap-1">
                  <Plus className="h-3 w-3" />
                  Create Tag
                </Button>
              </DialogTrigger>
              <DialogContent>
                <DialogHeader>
                  <DialogTitle>Create New Tag</DialogTitle>
                </DialogHeader>
                <div className="space-y-4">
                  <Input
                    placeholder="Tag name"
                    value={newTagName}
                    onChange={(e) => setNewTagName(e.target.value)}
                  />
                  <div>
                    <p className="text-sm font-medium mb-2">Color</p>
                    <div className="flex gap-2 flex-wrap">
                      {TAG_COLORS.map(color => (
                        <button
                          key={color}
                          className={cn(
                            "h-6 w-6 rounded-full transition-transform",
                            selectedColor === color && "ring-2 ring-offset-2 ring-primary scale-110"
                          )}
                          style={{ backgroundColor: color }}
                          onClick={() => setSelectedColor(color)}
                        />
                      ))}
                    </div>
                  </div>
                  <Button 
                    onClick={() => { createTag(); setDialogOpen(false); }}
                    disabled={!newTagName.trim() || creating}
                    className="w-full"
                  >
                    {creating ? <Loader2 className="h-4 w-4 animate-spin mr-2" /> : null}
                    Create Tag
                  </Button>
                </div>
              </DialogContent>
            </Dialog>
          </div>
        </PopoverContent>
      </Popover>
    </div>
  );
};
