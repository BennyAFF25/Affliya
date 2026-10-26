import assert from 'node:assert/strict';
import { firstBrandDestination } from '../utils/affiliate/firstBrand';
for (const destination of [null, '/affiliate/dashboard']) {
 assert.equal(firstBrandDestination(destination,false), '/onboarding/for-partners');
 for (const activity of [true,null]) assert.equal(firstBrandDestination(destination,activity), '/affiliate/dashboard');
}
for (const next of ['/affiliate/settings','/affiliate/inbox','/onboarding/for-partners?offerId=chosen','/affiliate/dashboard/promote/offer','/logout']) {
 assert.equal(firstBrandDestination(next,false),next);
}
console.log('First brand routing tests passed');

import { rankOnboardingOffers, type OnboardingOffer } from '../utils/affiliate/onboarding';
const offer = (title: string, readyOrganicCount: number): OnboardingOffer => ({
 id: title, title, description:'', logoUrl:null, commission:10, commissionValue:null,
 currency:'AUD',type:null,participationMode:'open',requestStatus:null,readyOrganicCount,
});
const offers=[offer('Nettmark Partner Programme',5),offer('Brand B',0),offer('Brand A',1)];
assert.deepEqual(rankOnboardingOffers(offers).map(row => row.title),['Brand A','Brand B','Nettmark Partner Programme']);
assert.equal(offers[0].title,'Nettmark Partner Programme');
