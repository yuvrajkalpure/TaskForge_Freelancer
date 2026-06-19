'use client';

import React, { useState, Suspense } from 'react';
import { useSearchParams } from 'next/navigation';

const API_BASE = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:5000';

function ResetPasswordContent() {
  const searchParams = useSearchParams();
  const token = searchParams.get('token');

  const [password, setPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [status, setStatus] = useState('form'); // form, loading, success, error
  const [message, setMessage] = useState('');

  const handleSubmit = async (e) => {
    e.preventDefault();

    if (!token) {
      alert('Reset token is missing from the link.');
      return;
    }

    if (password !== confirmPassword) {
      alert('Passwords do not match.');
      return;
    }

    setStatus('loading');
    try {
      const res = await fetch(`${API_BASE}/api/auth/reset-password`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ token, password }),
      });

      const data = await res.json();
      if (res.ok) {
        setStatus('success');
        setMessage(data.message || 'Password has been reset successfully!');
      } else {
        setStatus('error');
        setMessage(data.error || 'Failed to reset password.');
      }
    } catch (err) {
      setStatus('error');
      setMessage('Network error. Unable to connect to the backend server.');
    }
  };

  return (
    <div className="card" style={{ maxWidth: '500px', width: '100%', padding: '40px' }}>
      <div className="logo-icon" style={{ margin: '0 auto 20px auto', width: '48px', height: '48px', fontSize: '1.5rem' }}>T</div>
      <h1 style={{ marginBottom: '25px', fontSize: '2rem', textAlign: 'center' }}>Reset Password</h1>

      {status === 'form' && (
        <form onSubmit={handleSubmit}>
          <p style={{ color: 'var(--text-secondary)', marginBottom: '20px', fontSize: '0.9rem', textAlign: 'center' }}>
            Choose a new secure password for your TaskForge account.
          </p>
          
          <div className="form-group">
            <label>New Password (6+ characters)</label>
            <input 
              type="password" 
              className="form-control" 
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              placeholder="••••••••" 
              required 
              minLength={6}
            />
          </div>

          <div className="form-group">
            <label>Confirm New Password</label>
            <input 
              type="password" 
              className="form-control" 
              value={confirmPassword}
              onChange={(e) => setConfirmPassword(e.target.value)}
              placeholder="••••••••" 
              required 
              minLength={6}
            />
          </div>

          <button type="submit" className="btn btn-primary" style={{ width: '100%' }}>
            Save Password
          </button>
        </form>
      )}

      {status === 'loading' && (
        <div style={{ textAlign: 'center' }}>
          <p style={{ color: 'var(--text-secondary)', marginBottom: '20px' }}>Saving your new password...</p>
          <div className="spinner" />
        </div>
      )}

      {status === 'success' && (
        <div style={{ textAlign: 'center' }}>
          <div style={{ color: 'var(--color-success)', fontSize: '3.5rem', marginBottom: '15px' }}>✓</div>
          <p style={{ color: 'var(--text-secondary)', marginBottom: '30px' }}>{message}</p>
          <a href="/" className="btn btn-primary" style={{ width: '100%' }}>Sign In</a>
        </div>
      )}

      {status === 'error' && (
        <div style={{ textAlign: 'center' }}>
          <div style={{ color: 'var(--color-danger)', fontSize: '3.5rem', marginBottom: '15px' }}>✗</div>
          <p style={{ color: 'var(--text-secondary)', marginBottom: '30px' }}>{message}</p>
          <button className="btn btn-secondary" style={{ width: '100%' }} onClick={() => setStatus('form')}>
            Try Again
          </button>
        </div>
      )}
    </div>
  );
}

export default function ResetPassword() {
  return (
    <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', minHeight: '100vh', padding: '24px', backgroundColor: 'var(--bg-main)' }}>
      <Suspense fallback={<div>Loading form...</div>}>
        <ResetPasswordContent />
      </Suspense>
    </div>
  );
}
