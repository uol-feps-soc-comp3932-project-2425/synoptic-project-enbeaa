import React from "react";

type ButtonProps = {
  primary?: boolean;
  disabled?: boolean;
  icon?: string;
  onClick?: () => void;
  children: React.ReactNode;
  className?: string;
};

const Button: React.FC<ButtonProps> = ({
  primary = false,
  disabled = false,
  icon,
  onClick,
  children,
  className = "",
}) => {
  const buttonClass = `button ${
    primary ? "button-primary" : "button-secondary"
  } ${disabled ? "disabled" : ""} ${className}`;

  return (
    <button className={buttonClass} disabled={disabled} onClick={onClick}>
      {icon && <span className="icon">{icon}</span>}
      {children}
    </button>
  );
};

export default Button;
