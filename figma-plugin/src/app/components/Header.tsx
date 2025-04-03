import React from 'react';

const Header: React.FC = () => {
  return (
    <>
      <div className="banner">
        <h1>Spotlight</h1>
      </div>

      <div className="tabs">
        <div className="tab active" data-tab="component">
          Component Check
        </div>
        <div className="tab" data-tab="page">
          Page Report
        </div>
      </div>
    </>
  );
};

export default Header;
