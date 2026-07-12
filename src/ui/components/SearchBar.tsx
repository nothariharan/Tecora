import React, { useRef } from 'react';
import { T } from '../theme';

interface Props {
  value: string;
  onChange: (q: string) => void;
}

export function SearchBar({ value, onChange }: Props) {
  const timer = useRef<ReturnType<typeof setTimeout> | null>(null);

  function handleChange(e: React.ChangeEvent<HTMLInputElement>) {
    const v = e.target.value;
    if (timer.current) clearTimeout(timer.current);
    timer.current = setTimeout(() => onChange(v), 150);
  }

  return (
    <div style={{ padding: '8px 10px', borderBottom: `1px solid ${T.border}` }}>
      <input
        defaultValue={value}
        onChange={handleChange}
        placeholder="Search chats…"
        style={{
          width: '100%',
          boxSizing: 'border-box',
          border: `1px solid ${T.borderStrong}`,
          borderRadius: 6,
          padding: '6px 10px',
          fontSize: 13,
          outline: 'none',
          color: T.fg,
          background: T.hover,
        }}
      />
    </div>
  );
}
