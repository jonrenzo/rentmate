import { actor, route } from '@/lib/server/context';
import { ApiError, assertOrigin } from '@/lib/server/validation';

export async function POST(request: Request) {
  return route(async () => {
    assertOrigin(request);
    const { client, profile } = await actor();
    if (profile.role !== 'renter') throw new ApiError(403, 'Renter access required.');
    const { error } = await client.auth.updateUser({
      data: { rentmate_onboarding_complete: true },
    });
    if (error) throw new ApiError(503, 'Could not save your progress. Please try again.');
    return { ok: true };
  });
}
