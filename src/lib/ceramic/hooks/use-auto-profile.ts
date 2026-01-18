import { useEffect, useState } from 'react';
import { usePrivy } from '@privy-io/react-auth';
import { useCeramic } from '../ceramic-provider';
import { createOrUpdateCreator, getCreatorByDID } from '../creators';

/**
 * Hook to automatically create Ceramic profile on first login
 * This ensures every authenticated user has a Creator record in Ceramic
 */
export function useAutoProfileCreation() {
  const { authenticated, user } = usePrivy();
  const { ceramicDID } = useCeramic();
  const [attempted, setAttempted] = useState(false);

  useEffect(() => {
    async function ensureProfileExists() {
      // Only attempt once per session
      if (attempted || !authenticated || !user || !ceramicDID) return;

      setAttempted(true);

      try {
        // Check if profile already exists
        const existing = await getCreatorByDID(ceramicDID);
        if (existing) {
          console.log('✓ Profile already exists for', ceramicDID);
          return; // Profile exists, nothing to do
        }

        // Create initial profile from Privy data
        const defaultHandle =
          user.email?.address?.split('@')[0] ||
          user.google?.email?.split('@')[0] ||
          user.farcaster?.username ||
          `user_${user.id.slice(-8)}`;

        const defaultProfile = {
          did: ceramicDID,
          handle: defaultHandle,
          displayName:
            user.google?.name ||
            user.farcaster?.displayName ||
            user.twitter?.name ||
            'New User',
          avatar:
            user.twitter?.profilePictureUrl ||
            `https://api.dicebear.com/9.x/avataaars/svg?seed=${user.id}`,
          description: '',
          verified: false,
          followerCount: 0,
          followingCount: 0,
        };

        await createOrUpdateCreator(defaultProfile);
        console.log('✓ Auto-created Ceramic profile for', defaultProfile.handle);

        // Store in localStorage as backup
        localStorage.setItem('dragverse_profile', JSON.stringify(defaultProfile));
      } catch (error) {
        console.error('Auto-profile creation failed:', error);
        // Don't throw - allow user to continue and create manually in Settings
        // The app will fall back to localStorage/Privy data
      }
    }

    ensureProfileExists();
  }, [authenticated, user, ceramicDID, attempted]);
}
