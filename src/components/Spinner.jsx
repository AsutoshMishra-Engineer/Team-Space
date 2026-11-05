import React from 'react';

export default function Spinner({ size = 'md', text = '' }) {
  const sizes = {
    sm: 24,
    md: 40,
    lg: 64,
    xl: 90,
  };
  const px = sizes[size] || 40;

  return (
    <div className="spinner-wrapper">
      <svg
        className="spinner-circle"
        width={px}
        height={px}
        viewBox="0 0 50 50"
      >
        <circle
          className="spinner-track"
          cx="25" cy="25" r="20"
          fill="none"
          strokeWidth="4"
        />
        <circle
          className="spinner-head"
          cx="25" cy="25" r="20"
          fill="none"
          strokeWidth="4"
          strokeLinecap="round"
        />
      </svg>
      {text && <p className="spinner-text">{text}</p>}
    </div>
  );
}

/* Full page loading screen */
export function PageLoader({ text = 'Loading...' }) {
  return (
    <div className="page-loader">
      <div className="page-loader-inner">
        <svg className="spinner-circle" width="56" height="56" viewBox="0 0 50 50">
          <circle className="spinner-track" cx="25" cy="25" r="20" fill="none" strokeWidth="3.5"/>
          <circle className="spinner-head"  cx="25" cy="25" r="20" fill="none" strokeWidth="3.5" strokeLinecap="round"/>
        </svg>
        <p className="page-loader-text">{text}</p>
      </div>
    </div>
  );
}
