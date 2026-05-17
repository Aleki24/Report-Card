import React from 'react';

type MobileStatGridProps = {
  children: React.ReactNode;
};

export default function MobileStatGrid({ children }: MobileStatGridProps) {
  return <div className="grid grid-cols-2 gap-3 lg:grid-cols-4 lg:gap-5">{children}</div>;
}
