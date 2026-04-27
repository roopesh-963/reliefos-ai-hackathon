type BrandLogoProps = {
  className?: string;
  alt?: string;
};

export function BrandLogo({ className = 'h-10 w-auto', alt = 'ReliefOS logo' }: BrandLogoProps) {
  return <img src="/reliefos-logo.png" alt={alt} className={className} />;
}
