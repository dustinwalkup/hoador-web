interface MobileHeaderProps {
  title: string;
  description: string;
}

export function MobileHeader({ title, description }: MobileHeaderProps) {
  return (
    <div className="border-b border-gray-200 p-4">
      <h1 className="text-xl font-semibold text-gray-900">{title}</h1>
      <p className="mt-1 text-sm text-gray-600">{description}</p>
    </div>
  );
}
