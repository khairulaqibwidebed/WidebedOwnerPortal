// Run with the Firestore emulator:  firebase emulators:exec --only firestore --project demo-owner-portal "npx vitest run tests/rules.test.js"
import { describe, it, beforeAll, afterAll } from 'vitest';
import { initializeTestEnvironment, assertFails } from '@firebase/rules-unit-testing';
import { readFileSync } from 'node:fs';
import { doc, getDoc, setDoc, deleteDoc, getDocs, collection } from 'firebase/firestore';

let env;
beforeAll(async () => {
  env = await initializeTestEnvironment({ projectId: 'demo-owner-portal', firestore: { rules: readFileSync('firestore.rules', 'utf8'), host: '127.0.0.1', port: 8081 } });
  await env.withSecurityRulesDisabled(async ctx => { await setDoc(doc(ctx.firestore(), 'ownerLinks/ownerA'), { ownerId: 'o1', email: 'a@example.com' }); });
});
afterAll(() => env?.cleanup());

describe('portal rules: the browser gets nothing', () => {
  it('signed out cannot read a link', async () => { await assertFails(getDoc(doc(env.unauthenticatedContext().firestore(), 'ownerLinks/ownerA'))); });
  it('signed in owner cannot read their own link', async () => { await assertFails(getDoc(doc(env.authenticatedContext('ownerA', { email_verified: true }).firestore(), 'ownerLinks/ownerA'))); });
  it('signed in owner cannot read another owner link', async () => { await assertFails(getDoc(doc(env.authenticatedContext('ownerB', { email_verified: true }).firestore(), 'ownerLinks/ownerA'))); });
  it('cannot list the links', async () => { await assertFails(getDocs(collection(env.authenticatedContext('ownerA').firestore(), 'ownerLinks'))); });
  it('cannot write or change a link (no taking over another owner)', async () => {
    const db = env.authenticatedContext('ownerB', { email_verified: true }).firestore();
    await assertFails(setDoc(doc(db, 'ownerLinks/ownerB'), { ownerId: 'o1', email: 'b@example.com' }));
    await assertFails(setDoc(doc(db, 'ownerLinks/ownerA'), { ownerId: 'o2' }));
    await assertFails(deleteDoc(doc(db, 'ownerLinks/ownerA')));
  });
  it('cannot read or write any other collection', async () => {
    const db = env.authenticatedContext('ownerA', { email_verified: true }).firestore();
    await assertFails(getDoc(doc(db, 'units/u1'))); await assertFails(setDoc(doc(db, 'anything/x'), { a: 1 }));
  });
});
