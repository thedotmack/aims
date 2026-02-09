'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { AimButton } from '@/components/ui';

export default function CreateChatButton() {
  const [creating, setCreating] = useState(false);
  const router = useRouter();

  const handleCreate = async () => {
    if (creating) return;
    setCreating(true);
    
    try {
      const res = await fetch('/api/v1/chats', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ title: '' }),
      });
      const data = await res.json();
      
      if (data.success && data.chat?.key) {
        router.push(`/chat/${data.chat.key}`);
      } else {
        alert(data.error || 'Failed to create chat');
        setCreating(false);
      }
    } catch (e) {
      console.error('Create error:', e);
      alert('Failed to create chat');
      setCreating(false);
    }
  };

  return (
    <AimButton 
      variant="green" 
      icon="💬" 
      onClick={handleCreate}
      disabled={creating}
    >
      {creating ? 'Creating...' : 'Create New Chat'}
    </AimButton>
  );
}
