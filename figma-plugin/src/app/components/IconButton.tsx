import React from 'react';

type IconButtonProps = {
  icon: string;
  onClick?: () => void;
  className?: string;
  title?: string;
};

const IconButton: React.FC<IconButtonProps> = ({ icon, onClick, className = '', title }) => {
  return (
    <button className={`icon-button ${className}`} onClick={onClick} title={title}>
      <i className={icon}></i>
    </button>
  );
};

export default IconButton;
