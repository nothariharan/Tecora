import React, { useRef, useState } from 'react';
import { T } from '../theme';
import { IconSearch } from './Icons';

interface Props {
  value: string;
  onChange: (q: string) => void;
}

export function SearchBar({ value, onChange }: Props) {
  const timer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const [focused, setFocused] = useState(false);

  function handleChange(e: React.ChangeEvent<HTMLInputElement>) {
    const v = e.target.value;
    if (timer.current) clearTimeout(timer.current);
    timer.current = setTimeout(() => onChange(v), 150);
  }

  return (
    <div style={{ padding: '10px 12px', borderBottom: `1px solid ${T.border}` }}>
      <div style={{
        display: 'flex',
        alignItems: 'center',
        gap: 7,
        boxSizing: 'border-box',
        border: `1px solid ${focused ? T.borderStrong : T.border}`,
        borderRadius: T.radius,
        padding: '0 10px',
        background: focused ? T.bg : T.hover,
        transition: 'background 120ms, border-color 120ms',
      }}>
        <IconSearch size={15} style={{ color: T.icon }} />
        <input
          defaultValue={value}
          onChange={handleChange}
          onFocus={() => setFocused(true)}
          onBlur={() => setFocused(false)}
          placeholder="Search chats…"
          style={{
            flex: 1,
            border: 'none',
            padding: '7px 0',
            fontSize: 13,
            outline: 'none',
            color: T.fg,
            background: 'transparent',
          }}
        />
      </div>
    </div>
  );
}
