import type { Profile, Tenancy } from './types';

export function needsRenterOnboarding(
  profile: Profile,
  metadata: Record<string, unknown>,
  tenancies: Tenancy[],
): boolean {
  // This preference controls the welcome guide, never access to rental records.
  return profile.role === 'renter'
    && !profile.must_change_password
    && metadata.rentmate_onboarding_complete !== true
    && tenancies.some(t => t.renter_id === profile.id && t.status === 'active');
}
