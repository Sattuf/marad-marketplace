import ar from '../../content/legal/ar.json';
import en from '../../content/legal/en.json';
import tr from '../../content/legal/tr.json';
import { fill, getLegal, legalPath, LEGAL_DOCS, LEGAL_LANGS } from '@/lib/legal';

describe('legal pages', () => {
  const bundles = { ar, en, tr };

  it('every language has every document with the same number of sections and items', () => {
    for (const doc of LEGAL_DOCS) {
      const shape = (b: typeof ar) => b.docs[doc].sections.map((s) => s.items.length);
      expect(shape(en)).toEqual(shape(ar));
      expect(shape(tr)).toEqual(shape(ar));
    }
  });

  it('no placeholder is left unreplaced and no raw HTML is present', () => {
    for (const lang of LEGAL_LANGS) {
      for (const doc of LEGAL_DOCS) {
        const text = JSON.stringify(getLegal(lang, doc));
        expect(text).not.toMatch(/\{\{|\}\}/);
        expect(text).not.toMatch(/<[a-z]/i);
      }
    }
  });

  it('uses the deployment entity and a valid contact email, never an invalid one', () => {
    process.env.LEGAL_ENTITY_NAME = 'Marad Teknoloji A.Ş.';
    process.env.LEGAL_CONTACT_EMAIL = 'privacy@example.com';
    expect(fill('{{entity}} / {{contact}}', 'en')).toBe('Marad Teknoloji A.Ş. / privacy@example.com');
    process.env.LEGAL_CONTACT_EMAIL = 'not-an-email"><script>';
    expect(fill('{{contact}}', 'ar')).toBe(bundles.ar.contactFallback);
    delete process.env.LEGAL_ENTITY_NAME;
    delete process.env.LEGAL_CONTACT_EMAIL;
    expect(fill('{{entity}}', 'tr')).toContain("Ma'rad");
  });

  it('the privacy policy states the retention periods the code enforces', () => {
    const privacy = JSON.stringify(getLegal('en', 'privacy'));
    expect(privacy).toContain('6 months'); // personalization keep_months = 6
    expect(privacy).toContain('30 days'); // account deletion grace period (L-D5)
  });

  it('Arabic keeps the short store URLs; other languages live under /legal', () => {
    expect(legalPath('privacy')).toBe('/privacy');
    expect(legalPath('account-deletion', 'tr')).toBe('/legal/tr/account-deletion');
  });
});
