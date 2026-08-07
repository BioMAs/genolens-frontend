'use client';

/**
 * Choix du profil de pondération.
 *
 * La liste vient de l'API : `benchmark` est filtré côté genolens-dd, où il est annoté
 * « ne jamais servir à un client ». Ne jamais réintroduire de liste en dur ici.
 */
interface ProfileSelectorProps {
  profiles: string[];
  value: string;
  onChange: (profile: string) => void;
}

const LABELS: Record<string, string> = {
  default_oncology: 'Oncology (default)',
  first_in_class: 'First-in-class',
  fast_follower: 'Fast-follower',
  safety_first: 'Safety first',
};

export default function ProfileSelector({ profiles, value, onChange }: ProfileSelectorProps) {
  return (
    <label className="block text-sm">
      <span className="mb-1 block font-medium text-gray-700">Weighting profile</span>
      <select
        value={value}
        onChange={(event) => onChange(event.target.value)}
        className="w-full rounded-md border border-gray-300 p-2"
      >
        {profiles.map((profile) => (
          <option key={profile} value={profile}>
            {LABELS[profile] ?? profile}
          </option>
        ))}
      </select>
    </label>
  );
}
