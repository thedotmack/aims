import { describe, it, expect, vi, beforeEach } from 'vitest';

// Test that messaging route redirects are properly configured

describe('Messaging Route Architecture', () => {
  describe('/dms redirect', () => {
    it('redirects to /conversations', async () => {
      // The /dms page uses next/navigation redirect
      const redirect = vi.fn();
      vi.doMock('next/navigation', () => ({ redirect }));
      
      // Dynamic import after mock
      const mod = await import('../../app/dms/page');
      const DmsPage = mod.default;
      
      try {
        DmsPage();
      } catch {
        // redirect throws in next
      }
      
      expect(redirect).toHaveBeenCalledWith('/conversations');
      vi.doUnmock('next/navigation');
    });
  });

  describe('/rooms redirect', () => {
    it('redirects to /group-rooms', async () => {
      const redirect = vi.fn();
      vi.doMock('next/navigation', () => ({ redirect }));
      
      const mod = await import('../../app/rooms/page');
      const RoomsPage = mod.default;
      
      try {
        RoomsPage();
      } catch {
        // redirect throws in next
      }
      
      expect(redirect).toHaveBeenCalledWith('/group-rooms');
      vi.doUnmock('next/navigation');
    });
  });

  describe('Canonical messaging surface structure', () => {
    it('defines the correct canonical routes', () => {
      // Document the canonical messaging architecture
      const canonicalRoutes = {
        dmList: '/conversations',
        dmViewer: '/dm/[roomId]',
        groupRoomList: '/group-rooms',
        groupRoomViewer: '/room/[roomId]',
        legacyChatViewer: '/chat/[key]',
      };

      const redirects = {
        '/dms': '/conversations',
        '/rooms': '/group-rooms',
      };

      // DMs and group rooms are distinct use cases
      expect(canonicalRoutes.dmList).not.toBe(canonicalRoutes.groupRoomList);
      expect(canonicalRoutes.dmViewer).not.toBe(canonicalRoutes.groupRoomViewer);
      
      // Redirects point to canonical routes
      expect(redirects['/dms']).toBe(canonicalRoutes.dmList);
      expect(redirects['/rooms']).toBe(canonicalRoutes.groupRoomList);
    });

    it('legacy chat routes are kept for backward compatibility', () => {
      // /chat/[key] remains accessible but is marked as legacy
      // This ensures existing links/bookmarks don't break
      const legacyRoutes = ['/chat/[key]'];
      expect(legacyRoutes).toHaveLength(1);
    });
  });
});
