import { strict as assert } from 'node:assert';
import { test } from 'node:test';
import { needsRenterOnboarding } from '../lib/onboarding';
import type { Profile, Tenancy } from '../lib/types';

const renter: Profile = { id: 'renter', username: 'ana', full_name: 'Ana Reyes', phone: '', role: 'renter', must_change_password: false };
const tenancy: Tenancy = { id: 'tenancy', renter_id: 'renter', room_id: 'room', monthly_rent: 500000, due_day: 31, start_date: '2026-10-21', first_bill_month: '2026-10', end_date: null, status: 'active', advance_held: 0, deposit_held: 0 };

test('new renters see onboarding after securing their account, until completion is saved', () => {
  assert.equal(needsRenterOnboarding(renter, {}, [tenancy]), true);
  assert.equal(needsRenterOnboarding({ ...renter, must_change_password: true }, {}, [tenancy]), false);
  assert.equal(needsRenterOnboarding(renter, { rentmate_onboarding_complete: true }, [tenancy]), false);
  assert.equal(needsRenterOnboarding(renter, { rentmate_onboarding_complete: false }, [tenancy]), true);
});

test('onboarding excludes owners and renters without their own active tenancy', () => {
  assert.equal(needsRenterOnboarding({ ...renter, role: 'owner' }, {}, [tenancy]), false);
  assert.equal(needsRenterOnboarding(renter, {}, []), false);
  assert.equal(needsRenterOnboarding(renter, {}, [{ ...tenancy, status: 'ended' }]), false);
  assert.equal(needsRenterOnboarding(renter, {}, [{ ...tenancy, renter_id: 'someone-else' }]), false);
});
