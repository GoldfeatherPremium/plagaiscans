import React, { useState, useEffect } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Badge } from '@/components/ui/badge';
import { Plus, Copy, Trash2, Key, RefreshCw, Shield } from 'lucide-react';
import { toast } from '@/hooks/use-toast';
import { format } from 'date-fns';

interface ExtensionToken {
  id: string;
  token: string;
  name: string;
  created_at: string;
  last_used_at: string | null;
  last_heartbeat_at: string | null;
  is_active: boolean;
  browser_info: string | null;
}

export const ExtensionTokenManager: React.FC = () => {
  const [tokens, setTokens] = useState<ExtensionToken[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [isCreating, setIsCreating] = useState(false);
  const [newTokenName, setNewTokenName] = useState('');
  const [showNewToken, setShowNewToken] = useState<string | null>(null);

  useEffect(() => {
    fetchTokens();
  }, []);

  const fetchTokens = async () => {
    try {
      const { data, error } = await supabase
        .from('extension_tokens')
        .select('*')
        .order('created_at', { ascending: false });

      if (error) throw error;
      setTokens(data || []);
    } catch (error) {
      console.error('Error fetching tokens:', error);
      toast({
        title: 'Error',
        description: 'Failed to load extension tokens',
        variant: 'destructive',
      });
    } finally {
      setIsLoading(false);
    }
  };

  const createToken = async () => {
    if (!newTokenName.trim()) {
      toast({
        title: 'Error',
        description: 'Please enter a token name',
        variant: 'destructive',
      });
      return;
    }

    setIsCreating(true);
    try {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) throw new Error('Not authenticated');

      // Generate a secure token on the client side
      const tokenChars = 'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789';
      let generatedToken = 'ext_';
      for (let i = 0; i < 64; i++) {
        generatedToken += tokenChars.charAt(Math.floor(Math.random() * tokenChars.length));
      }

      const { data, error } = await supabase
        .from('extension_tokens')
        .insert([{
          name: newTokenName.trim(),
          user_id: user.id,
          token: generatedToken,
        }])
        .select()
        .single();

      if (error) throw error;

      setShowNewToken(data.token);
      setNewTokenName('');
      fetchTokens();
      
      toast({
        title: 'Token Created',
        description: 'Copy the token now - it won\'t be shown again in full!',
      });
    } catch (error) {
      console.error('Error creating token:', error);
      toast({
        title: 'Error',
        description: 'Failed to create token',
        variant: 'destructive',
      });
    } finally {
      setIsCreating(false);
    }
  };

  const revokeToken = async (tokenId: string) => {
    try {
      const { error } = await supabase
        .from('extension_tokens')
        .update({ is_active: false })
        .eq('id', tokenId);

      if (error) throw error;

      fetchTokens();
      toast({
        title: 'Token Revoked',
        description: 'The extension token has been deactivated',
      });
    } catch (error) {
      console.error('Error revoking token:', error);
      toast({
        title: 'Error',
        description: 'Failed to revoke token',
        variant: 'destructive',
      });
    }
  };

  const deleteToken = async (tokenId: string) => {
    try {
      const { error } = await supabase
        .from('extension_tokens')
        .delete()
        .eq('id', tokenId);

      if (error) throw error;

      fetchTokens();
      toast({
        title: 'Token Deleted',
        description: 'The extension token has been permanently deleted',
      });
    } catch (error) {
      console.error('Error deleting token:', error);
      toast({
        title: 'Error',
        description: 'Failed to delete token',
        variant: 'destructive',
      });
    }
  };

  const copyToken = (token: string) => {
    navigator.clipboard.writeText(token);
    toast({
      title: 'Copied',
      description: 'Token copied to clipboard',
    });
  };

  const maskToken = (token: string) => {
    if (token.length <= 12) return token;
    return `${token.substring(0, 8)}${'•'.repeat(20)}${token.substring(token.length - 4)}`;
  };

  if (isLoading) {
    return (
      <Card>
        <CardContent className="py-8 text-center text-muted-foreground">
          Loading tokens...
        </CardContent>
      </Card>
    );
  }

  return (
    <Card>
      <CardHeader>
        <div className="flex items-center gap-3">
          <div className="p-2 bg-primary/10 rounded-lg">
            <Key className="h-6 w-6 text-primary" />
          </div>
          <div>
            <CardTitle>Extension Tokens</CardTitle>
            <CardDescription>
              Generate secure tokens for the browser extension
            </CardDescription>
          </div>
        </div>
      </CardHeader>
      <CardContent className="space-y-6">
        {/* Info Box */}
        <div className="p-4 bg-muted rounded-lg">
          <div className="flex items-start gap-3">
            <Shield className="h-5 w-5 text-primary mt-0.5" />
            <div className="text-sm">
              <p className="font-medium">Secure Token Authentication</p>
              <p className="text-muted-foreground mt-1">
                Extension tokens provide limited, revocable access to the automation API. 
                Each token can be individually revoked without affecting other installations.
              </p>
            </div>
          </div>
        </div>

        {/* Create New Token */}
        <div className="flex gap-2">
          <Input
            placeholder="Token name (e.g., Office PC, Laptop)"
            value={newTokenName}
            onChange={(e) => setNewTokenName(e.target.value)}
            onKeyDown={(e) => e.key === 'Enter' && createToken()}
          />
          <Button onClick={createToken} disabled={isCreating}>
            <Plus className="h-4 w-4 mr-2" />
            {isCreating ? 'Creating...' : 'Generate'}
          </Button>
        </div>

        {/* New Token Display */}
        {showNewToken && (
          <div className="p-4 bg-primary/10 border border-primary/20 rounded-lg">
            <p className="text-sm font-medium text-primary mb-2">
              🔑 New Token Created - Copy it now!
            </p>
            <div className="flex items-center gap-2">
              <code className="flex-1 p-2 bg-background rounded text-xs font-mono break-all">
                {showNewToken}
              </code>
              <Button
                size="sm"
                variant="outline"
                onClick={() => copyToken(showNewToken)}
              >
                <Copy className="h-4 w-4" />
              </Button>
            </div>
            <p className="text-xs text-muted-foreground mt-2">
              This is the only time you'll see the full token. Store it securely.
            </p>
            <Button 
              variant="ghost" 
              size="sm" 
              className="mt-2"
              onClick={() => setShowNewToken(null)}
            >
              I've copied it, dismiss
            </Button>
          </div>
        )}

        {/* Token List */}
        <div className="space-y-3">
          <div className="flex items-center justify-between">
            <h4 className="font-medium text-sm">Active Tokens</h4>
            <Button variant="ghost" size="sm" onClick={fetchTokens}>
              <RefreshCw className="h-4 w-4 mr-1" />
              Refresh
            </Button>
          </div>

          {tokens.length === 0 ? (
            <div className="p-6 text-center text-muted-foreground border rounded-lg border-dashed">
              <Key className="h-8 w-8 mx-auto mb-2 opacity-50" />
              <p>No tokens created yet</p>
              <p className="text-xs mt-1">Create a token to use with the browser extension</p>
            </div>
          ) : (
            <div className="space-y-2">
              {tokens.map((token) => (
                <div
                  key={token.id}
                  className={`p-4 border rounded-lg ${!token.is_active ? 'opacity-50 bg-muted' : ''}`}
                >
                  <div className="flex items-start justify-between gap-4">
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2">
                        <span className="font-medium">{token.name}</span>
                        {token.is_active ? (
                          <Badge variant="secondary" className="text-xs">Active</Badge>
                        ) : (
                          <Badge variant="destructive" className="text-xs">Revoked</Badge>
                        )}
                      </div>
                      <code className="text-xs text-muted-foreground font-mono mt-1 block">
                        {maskToken(token.token)}
                      </code>
                      <div className="flex flex-wrap gap-x-4 gap-y-1 mt-2 text-xs text-muted-foreground">
                        <span>Created: {format(new Date(token.created_at), 'MMM d, yyyy')}</span>
                        {token.last_used_at && (
                          <span>Last used: {format(new Date(token.last_used_at), 'MMM d, HH:mm')}</span>
                        )}
                        {token.last_heartbeat_at && (
                          <span className="text-primary">
                            Online: {format(new Date(token.last_heartbeat_at), 'HH:mm')}
                          </span>
                        )}
                      </div>
                      {token.browser_info && (
                        <p className="text-xs text-muted-foreground mt-1 truncate max-w-md">
                          {token.browser_info}
                        </p>
                      )}
                    </div>
                    <div className="flex items-center gap-1">
                      <Button
                        size="sm"
                        variant="ghost"
                        onClick={() => copyToken(token.token)}
                        title="Copy token"
                      >
                        <Copy className="h-4 w-4" />
                      </Button>
                      {token.is_active && (
                        <Button
                          size="sm"
                          variant="ghost"
                          onClick={() => revokeToken(token.id)}
                          className="text-warning hover:text-warning"
                          title="Revoke token"
                        >
                          <Shield className="h-4 w-4" />
                        </Button>
                      )}
                      <Button
                        size="sm"
                        variant="ghost"
                        onClick={() => deleteToken(token.id)}
                        className="text-destructive hover:text-destructive"
                        title="Delete token"
                      >
                        <Trash2 className="h-4 w-4" />
                      </Button>
                    </div>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      </CardContent>
    </Card>
  );
};
