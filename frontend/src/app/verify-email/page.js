'use client';

import React, { useEffect, useState, Suspense } from 'react';
import { useSearchParams } from 'next/navigation';

const API_BASE = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:5000';

function VerifyEmailContent() {
  const searchParams = useSearchParams();

  const emailParam = searchParams.get('email') || '';
  const otpParam = searchParams.get('otp') || '';
  const tokenParam = searchParams.get('token') || ''; // Support old token fallback if any link contains it

  const [email, setEmail] = useState(emailParam);
  const [otpInput, setOtpInput] = useState(otpParam);
  const [status, setStatus] = useState('form'); // form, loading, success, error
  const [message, setMessage] = useState('');

  // Auto-verify if old token param exists
  useEffect(() => {
    if (tokenParam) {
      const verifyToken = async () => {
        setStatus('loading');
        try {
          const res = await fetch(`${API_BASE}/api/auth/verify-email`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ token: tokenParam }),
          });

          const data = await res.json();
          if (res.ok) {
            setStatus('success');
            setMessage(data.message || 'Email verified successfully!');
          } else {
            setStatus('error');
            setMessage(data.error || 'Failed to verify email.');
          }
        } catch (err) {
          setStatus('error');
          setMessage('Network error. Unable to connect to the backend server.');
        }
      };
      verifyToken();
    }
  }, [tokenParam]);

  // Set local state if search params change
  useEffect(() => {
    if (emailParam) setEmail(emailParam);
    if (otpParam) setOtpInput(otpParam);
  }, [emailParam, otpParam]);

  const handleSubmit = async (e) => {
    e.preventDefault();
    if (!email || !otpInput) {
      alert('Email and OTP are required.');
      return;
    }

    setStatus('loading');
    try {
      const res = await fetch(`${API_BASE}/api/auth/verify-otp`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email, otp: otpInput }),
      });

      const data = await res.json();
      if (res.ok) {
        // Store session tokens (just like login)
        localStorage.setItem('tf_access_token', data.accessToken);
        localStorage.setItem('tf_refresh_token', data.refreshToken);
        localStorage.setItem('tf_user', JSON.stringify(data.user));

        setStatus('success');
        setMessage(data.message || 'Email address verified and account created successfully!');
      } else {
        setStatus('error');
        setMessage(data.error || 'Failed to verify OTP.');
      }
    } catch (err) {
      setStatus('error');
      setMessage('Network error. Unable to connect to the backend server.');
    }
  };

  return (
    <div style={{ width: '100%', maxWidth: '500px' }}>
      {/* Fallback OTP Debug Banner */}
      {otpParam && (
        <div style={{
          background: '#fef08a',
          color: '#854d0e',
          padding: '14px',
          borderRadius: 'var(--radius-md)',
          textAlign: 'center',
          fontWeight: '600',
          fontSize: '0.9rem',
          border: '1px solid #fef3c7',
          boxShadow: 'var(--shadow-sm)',
          marginBottom: '20px'
        }}>
          ⚠️ Debug: Verification OTP is <span style={{
            fontFamily: 'monospace',
            fontSize: '1.15rem',
            background: '#ffffff',
            padding: '2px 8px',
            borderRadius: '4px',
            border: '1px solid #fef3c7',
            marginLeft: '4px'
          }}>{otpParam}</span>
        </div>
      )}

      <div className="card" style={{ padding: '40px', textAlign: 'center' }}>
        <div className="logo-icon" style={{ margin: '0 auto 20px auto', width: '48px', height: '48px', fontSize: '1.5rem' }}>T</div>
        <h1 style={{ marginBottom: '15px', fontSize: '2rem' }}>Email Activation</h1>

        {status === 'form' && (
          <form onSubmit={handleSubmit} style={{ textAlign: 'left' }}>
            <p style={{ color: 'var(--text-secondary)', marginBottom: '20px', fontSize: '0.9rem', textAlign: 'center' }}>
              Please enter the 6-digit OTP code sent to your email to activate your account.
            </p>

            <div className="form-group">
              <label>Email Address</label>
              <input
                type="email"
                className="form-control"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                placeholder="you@example.com"
                required
                readOnly={!!emailParam}
                style={emailParam ? { backgroundColor: '#f1f5f9', cursor: 'not-allowed' } : {}}
              />
            </div>

            <div className="form-group">
              <label>6-Digit OTP</label>
              <input
                type="text"
                className="form-control"
                value={otpInput}
                onChange={(e) => setOtpInput(e.target.value)}
                placeholder="123456"
                required
                maxLength={6}
                pattern="\d{6}"
                style={{ textAlign: 'center', fontSize: '1.4rem', letterSpacing: '4px', fontWeight: 'bold' }}
              />
            </div>

            <button type="submit" className="btn btn-primary" style={{ width: '100%', marginTop: '10px' }}>
              Verify OTP
            </button>
          </form>
        )}

        {status === 'loading' && (
          <div>
            <p style={{ color: 'var(--text-secondary)', marginBottom: '20px' }}>Verifying, please wait...</p>
            <div className="spinner" />
          </div>
        )}

        {status === 'success' && (
          <div>
            <div style={{ color: 'var(--color-success)', fontSize: '3rem', marginBottom: '15px' }}>✓</div>
            <p style={{ color: 'var(--text-secondary)', marginBottom: '30px' }}>{message}</p>
            <button onClick={() => {
              // Redirect to main page where it will mount and detect the user session
              window.location.href = '/';
            }} className="btn btn-primary" style={{ width: '100%' }}>
              Go to Dashboard
            </button>
          </div>
        )}

        {status === 'error' && (
          <div>
            <div style={{ color: 'var(--color-danger)', fontSize: '3rem', marginBottom: '15px' }}>✗</div>
            <p style={{ color: 'var(--text-secondary)', marginBottom: '30px' }}>{message}</p>
            <button className="btn btn-secondary" style={{ width: '100%' }} onClick={() => setStatus('form')}>
              Try Again
            </button>
          </div>
        )}
      </div>
    </div>
  );
}

export default function VerifyEmail() {
  return (
    <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', minHeight: '100vh', padding: '24px', backgroundColor: 'var(--bg-main)' }}>
      <Suspense fallback={<div>Loading verification...</div>}>
        <VerifyEmailContent />
      </Suspense>
    </div>
  );
}
