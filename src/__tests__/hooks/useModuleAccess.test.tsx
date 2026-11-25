/**
 * Les verrous de la page de lecture, en un seul objet.
 *
 * Les réponses de la page se débloquent chacune derrière un module : la lecture de peau, les
 * cibles, les outils scientifiques, la personnalisation du rapport, l'IA. Ce hook les regroupe
 * pour que la page pose une question, mais ne décide de rien lui-même — il lit les drapeaux que
 * `/users/me` sert déjà et le contournement par rôle qu'`isPrivilegedRole` définit déjà.
 */
import { renderHook } from '@testing-library/react';
import { useModuleAccess, type ModuleAccess } from '@/hooks/useModuleAccess';
import { useUserProfile } from '@/hooks/useUserProfile';
import type { UserProfile } from '@/types';

jest.mock('@/hooks/useUserProfile');
const mockUseUserProfile = useUserProfile as jest.MockedFunction<typeof useUserProfile>;

const BASE: UserProfile = {
  id: 'u1',
  email: 'a@b.c',
  role: 'RESEARCHER',
  subscription_plan: 'STARTER',
  ai_interpretations_used: 0,
  ai_tokens_purchased: 0,
  ai_tokens_used: 0,
};

function accessFor(profile: Partial<UserProfile> | undefined): ModuleAccess {
  mockUseUserProfile.mockReturnValue({
    data: profile ? { ...BASE, ...profile } : undefined,
  } as ReturnType<typeof useUserProfile>);
  return renderHook(() => useModuleAccess()).result.current;
}

const NOTHING: ModuleAccess = {
  skin: false,
  targets: false,
  science: false,
  report: false,
  ai: false,
  loaded: false,
};

describe('useModuleAccess', () => {
  it('ne débloque rien tant que le profil est en route, et le dit par loaded', () => {
    expect(accessFor(undefined)).toEqual(NOTHING);
  });

  it('rend loaded dès que le profil est là', () => {
    expect(accessFor({}).loaded).toBe(true);
  });

  it('verrouille tout pour un compte sans module ni plan IA', () => {
    expect(accessFor({ role: 'RESEARCHER', has_cosmetics_module: false })).toEqual({
      ...NOTHING,
      loaded: true,
    });
  });

  it('lit has_cosmetics_module pour skin', () => {
    expect(accessFor({ has_cosmetics_module: true })).toEqual({
      ...NOTHING,
      loaded: true,
      skin: true,
    });
    expect(accessFor({ role: 'RESEARCHER', has_cosmetics_module: false }).skin).toBe(false);
  });

  it('lit has_drug_discovery_module pour targets', () => {
    expect(accessFor({ has_drug_discovery_module: true })).toEqual({
      ...NOTHING,
      loaded: true,
      targets: true,
    });
  });

  it('lit has_scientific_module pour science', () => {
    expect(accessFor({ has_scientific_module: true })).toEqual({
      ...NOTHING,
      loaded: true,
      science: true,
    });
  });

  it('lit has_report_customization pour report', () => {
    expect(accessFor({ has_report_customization: true })).toEqual({
      ...NOTHING,
      loaded: true,
      report: true,
    });
  });

  it('ne prend que `true` pour un drapeau levé', () => {
    const odd = { has_cosmetics_module: 1, has_scientific_module: 'yes' } as unknown as Partial<UserProfile>;
    const access = accessFor(odd);
    expect(access.skin).toBe(false);
    expect(access.science).toBe(false);
  });

  describe('ai suit canUseAI, plan et crédits compris', () => {
    it('refuse un STARTER sans crédit accordé', () => {
      expect(accessFor({ subscription_plan: 'STARTER' }).ai).toBe(false);
    });

    it('accorde TEAM et ON_PREMISE', () => {
      expect(accessFor({ subscription_plan: 'TEAM' }).ai).toBe(true);
      expect(accessFor({ subscription_plan: 'ON_PREMISE' }).ai).toBe(true);
    });

    it('accorde un STARTER à qui un admin a accordé des requêtes IA', () => {
      expect(accessFor({ subscription_plan: 'STARTER', ai_requests_limit: 5 }).ai).toBe(true);
      expect(accessFor({ subscription_plan: 'STARTER', ai_requests_limit: 0 }).ai).toBe(false);
    });

    it("n'ouvre pas les modules : l'IA ne vient pas avec eux", () => {
      const access = accessFor({ subscription_plan: 'TEAM' });
      expect(access).toMatchObject({ ai: true, skin: false, targets: false, science: false, report: false });
    });
  });

  describe('contournement par rôle', () => {
    it.each(['ADMIN', 'SCILICIUM_ADMIN'])('%s a tout, sans drapeau ni plan', (role) => {
      expect(accessFor({ role, subscription_plan: 'STARTER' })).toEqual({
        skin: true,
        targets: true,
        science: true,
        report: true,
        ai: true,
        loaded: true,
      });
    });

    it('reconnaît le rôle quelle que soit la casse, comme isPrivilegedRole', () => {
      expect(accessFor({ role: 'scilicium_admin' })).toMatchObject({
        skin: true,
        targets: true,
        science: true,
        report: true,
      });
    });

    it("ne l'étend pas à un rôle voisin", () => {
      expect(accessFor({ role: 'ADMINISTRATOR' })).toEqual({ ...NOTHING, loaded: true });
    });
  });
});
