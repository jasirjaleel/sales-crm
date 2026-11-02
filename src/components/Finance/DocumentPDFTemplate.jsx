import React from 'react';
import { brand } from '../../lib/brand';

// A styled component purely for generating PDF via html2pdf
// Hidden from view, attached to DOM only when generating.
const DocumentPDFTemplate = React.forwardRef(({ type, data }, ref) => {
  const isInvoice = type === 'invoice';

  const formatCurrency = (amount) => {
    return new Intl.NumberFormat('en-IN', { style: 'currency', currency: 'INR', maximumFractionDigits: 0 }).format(amount);
  };

  const netAmount = Number(data.price || data.amount || 0) - Number(data.discount || 0);

  const deliverableLines = (data.deliverables || '').split('\n').filter(line => line.trim() !== '');

  return (
    <div ref={ref} style={{
      width: '800px', // Fixed width for A4 aspect ratio rendering
      minHeight: '1131px', // A4 aspect ratio
      padding: '0',
      background: '#FCFAF5', // Cream background
      color: '#2A2A2A',
      fontFamily: '"Inter", sans-serif',
      boxSizing: 'border-box',
      position: 'relative'
    }}>
      
      {/* Top Dark Header Block */}
      <div style={{ background: '#1A1E1A', padding: '30px 40px', width: '60%', display: 'flex', alignItems: 'center', gap: '10px' }}>
        <span style={{ color: '#C8B48A', fontSize: '24px', fontFamily: 'serif', fontWeight: 'bold', letterSpacing: '1px' }}>{brand.website.toUpperCase()}</span>
        <span style={{ color: '#E0E0E0', fontSize: '14px', fontStyle: 'italic', marginLeft: '5px' }}>
          {isInvoice ? 'Official Invoice' : 'Phase 2: Finalization & Scope'}
        </span>
      </div>

      <div style={{ padding: '50px 60px' }}>
        
        {/* Main Title Area */}
        <div style={{ marginBottom: '40px' }}>
          <h1 style={{ margin: '0 0 10px', fontSize: '32px', fontFamily: 'serif', fontWeight: 'normal', color: '#1A1A1A' }}>
            {isInvoice ? 'Invoice & Agreement' : 'Project Finalization & Agreement'}
          </h1>
          <h2 style={{ margin: '0', fontSize: '12px', color: '#C8B48A', textTransform: 'uppercase', letterSpacing: '2px', fontFamily: 'monospace' }}>
            {isInvoice ? 'BILLING DETAILS — ' : 'PHASE 2 QUOTATION — '} 
            {data.service || data.quotation_service || 'CUSTOM PACKAGE'}
          </h2>
        </div>

        {/* Prepared For / By */}
        <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '40px' }}>
          <div>
            <h3 style={{ margin: '0 0 8px', fontSize: '10px', color: '#1A1A1A', textTransform: 'uppercase', letterSpacing: '2px', fontWeight: 'bold' }}>PREPARED FOR</h3>
            <p style={{ margin: '0 0 4px', fontSize: '14px' }}>{data.lead_name}</p>
            {data.lead_email && <p style={{ margin: '0 0 4px', fontSize: '14px' }}>{data.lead_email}</p>}
            {data.lead_phone && <p style={{ margin: '0', fontSize: '14px' }}>{data.lead_phone}</p>}
          </div>
          <div style={{ textAlign: 'right' }}>
            <h3 style={{ margin: '0 0 8px', fontSize: '10px', color: '#1A1A1A', textTransform: 'uppercase', letterSpacing: '2px', fontWeight: 'bold' }}>PREPARED BY</h3>
            <p style={{ margin: '0 0 4px', fontSize: '14px' }}>{data.agent_name || brand.signatory}</p>
            <p style={{ margin: '0 0 4px', fontSize: '14px' }}>{brand.website}</p>
            <p style={{ margin: '0', fontSize: '14px' }}>{new Date(data.created_at || data.issue_date || Date.now()).toLocaleDateString('en-US', { month: 'long', day: 'numeric', year: 'numeric' })}</p>
          </div>
        </div>

        {/* Intro Box */}
        {(data.timeline || data.notes) && (
          <div style={{ background: '#F0EBE1', padding: '20px 25px', marginBottom: '40px', borderRadius: '4px' }}>
            <p style={{ margin: 0, fontSize: '14px', lineHeight: '1.6', color: '#333' }}>
              <strong>Project Timeline / Status:</strong> {data.timeline || data.notes}
            </p>
          </div>
        )}

        {/* Section 1: Scope */}
        <div style={{ marginBottom: '40px' }}>
          <h3 style={{ margin: '0 0 15px', paddingBottom: '10px', borderBottom: '1px solid #D7C29B', fontSize: '16px', fontFamily: 'serif', letterSpacing: '1px', color: '#1A1A1A' }}>
            1. SCOPE OF WORK & DELIVERABLES
          </h3>
          {deliverableLines.length > 0 ? (
            <ul style={{ margin: 0, paddingLeft: '20px', fontSize: '14px', lineHeight: '1.8' }}>
              {deliverableLines.map((line, idx) => (
                <li key={idx} style={{ marginBottom: '10px' }}>{line.replace(/^-\s*/, '')}</li>
              ))}
            </ul>
          ) : (
            <p style={{ margin: 0, fontSize: '14px', lineHeight: '1.6' }}>{data.service || data.quotation_service}</p>
          )}
        </div>

        {/* Section 2: Terms & Responsibilities */}
        {data.terms && (
          <div style={{ marginBottom: '40px' }}>
            <h3 style={{ margin: '0 0 15px', paddingBottom: '10px', borderBottom: '1px solid #D7C29B', fontSize: '16px', fontFamily: 'serif', letterSpacing: '1px', color: '#1A1A1A' }}>
              2. TERMS & CLIENT RESPONSIBILITIES
            </h3>
            <p style={{ margin: 0, fontSize: '14px', lineHeight: '1.8', whiteSpace: 'pre-wrap' }}>
              {data.terms}
            </p>
          </div>
        )}

        {/* Section 3: Payment */}
        <div style={{ marginBottom: '40px' }}>
          <h3 style={{ margin: '0 0 15px', paddingBottom: '10px', borderBottom: '1px solid #D7C29B', fontSize: '16px', fontFamily: 'serif', letterSpacing: '1px', color: '#1A1A1A' }}>
            {isInvoice ? '3. INVOICE DETAILS' : '3. PAYMENT COLLECTION'}
          </h3>
          <p style={{ margin: '0 0 20px', fontSize: '14px', lineHeight: '1.6' }}>
            Total package investment is <strong>{formatCurrency(netAmount)}</strong>.
            {isInvoice && ` Please ensure payment is completed by ${new Date(data.due_date).toLocaleDateString('en-US', { month: 'long', day: 'numeric', year: 'numeric' })}.`}
          </p>

          <div style={{ border: '1px solid #D7C29B', padding: '30px', background: '#FFFFFF' }}>
            <h4 style={{ margin: '0 0 25px', textAlign: 'center', fontSize: '14px', fontFamily: 'serif', letterSpacing: '2px', color: '#1A1A1A' }}>
              PAYMENT INSTRUCTIONS
            </h4>
            
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '20px', fontSize: '14px', marginBottom: '20px' }}>
              <div style={{ fontWeight: 'bold' }}>Total Amount:</div>
              <div>{formatCurrency(netAmount)}</div>
              
              {isInvoice && (
                <>
                  <div style={{ fontWeight: 'bold' }}>Invoice Number:</div>
                  <div>{data.invoice_number}</div>
                </>
              )}

              <div style={{ fontWeight: 'bold' }}>UPI ID:</div>
              <div>{brand.upiId}</div>
              
              <div style={{ fontWeight: 'bold' }}>Name:</div>
              <div>{brand.legalName}</div>
            </div>

            <div style={{ borderTop: '1px solid #EFEFEF', marginTop: '20px', paddingTop: '20px', display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '20px', fontSize: '18px', color: '#C8B48A', fontWeight: 'bold' }}>
              <div>{isInvoice ? 'Amount Due:' : 'Balance Amount:'}</div>
              <div>{formatCurrency(netAmount)}</div>
            </div>
          </div>
        </div>

      </div>
    </div>
  );
});

export default DocumentPDFTemplate;
