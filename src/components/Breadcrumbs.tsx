import React from 'react';
import { Link } from 'react-router-dom';
import { ChevronRightIcon } from '@/components/icons/Icons';

export interface BreadcrumbItem {
  label: string;
  to?: string;
}

interface BreadcrumbsProps {
  items: BreadcrumbItem[];
}

export const Breadcrumbs: React.FC<BreadcrumbsProps> = ({ items }) => {
  return (
    <nav className="breadcrumbs" aria-label="Ruta de navegación">
      <Link to="/" style={{ color: 'var(--text-muted)' }}>Inicio</Link>
      {items.map((item, idx) => (
        <React.Fragment key={idx}>
          <span className="breadcrumb-separator" aria-hidden="true">
            <ChevronRightIcon size={14} />
          </span>
          {item.to ? (
            <Link to={item.to}>{item.label}</Link>
          ) : (
            <span aria-current="page" style={{ color: 'var(--text-primary)', fontWeight: 600 }}>
              {item.label}
            </span>
          )}
        </React.Fragment>
      ))}
    </nav>
  );
};
