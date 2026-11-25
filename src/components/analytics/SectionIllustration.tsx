import { healthIllustrations, HealthIllustration } from './healthSectionDesigns';

export default function SectionIllustration({ name, decorative = false }: { name: HealthIllustration; decorative?: boolean }) {
  const artwork = healthIllustrations[name];
  return <img className={`section-illustration${'monochrome' in artwork && artwork.monochrome ? ' section-illustration-mono' : ''}`}
    src={`${import.meta.env.BASE_URL}images/salud/${artwork.file}`} alt={decorative ? '' : artwork.label}
    width={200} height={200} decoding="async" />;
}
