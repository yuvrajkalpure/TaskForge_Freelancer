'use client';

import React, { useState, useEffect } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { useRouter } from 'next/navigation';

const API_BASE = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:5000';

export default function Home() {
  const queryClient = useQueryClient();
  const router = useRouter();

  // Local State
  const [user, setUser] = useState(null);
  const [token, setToken] = useState(null);
  const [refreshToken, setRefreshToken] = useState(null);
  const [activeTab, setActiveTab] = useState('browse');
  const [selectedProjectId, setSelectedProjectId] = useState(null);
  const [search, setSearch] = useState('');
  const [statusFilter, setStatusFilter] = useState('');
  
  // Form states
  const [loginEmail, setLoginEmail] = useState('');
  const [loginPassword, setLoginPassword] = useState('');
  const [regFullName, setRegFullName] = useState('');
  const [regEmail, setRegEmail] = useState('');
  const [regPassword, setRegPassword] = useState('');
  const [regRole, setRegRole] = useState('client');
  const [forgotEmail, setForgotEmail] = useState('');
  const [showForgot, setShowForgot] = useState(false);
  const [isLoginView, setIsLoginView] = useState(true);

  // Project Post Form
  const [postTitle, setPostTitle] = useState('');
  const [postDescription, setPostDescription] = useState('');
  const [postBudget, setPostBudget] = useState('');

  // Bid Form
  const [bidAmount, setBidAmount] = useState('');
  const [bidProposal, setBidProposal] = useState('');

  // Review Form
  const [reviewRating, setReviewRating] = useState(5);
  const [reviewComment, setReviewComment] = useState('');

  // Toasts
  const [toasts, setToasts] = useState([]);

  const showToast = (message, type = 'info') => {
    setToasts(prev => {
      if (prev.some(t => t.message === message)) {
        return prev;
      }
      const id = `${Date.now()}-${Math.random()}`;
      setTimeout(() => {
        setToasts(current => current.filter(t => t.id !== id));
      }, 4000);
      return [...prev, { id, message, type }];
    });
  };

  // Check Local Storage on Mount
  useEffect(() => {
    const savedUser = localStorage.getItem('tf_user');
    const savedToken = localStorage.getItem('tf_access_token');
    const savedRefresh = localStorage.getItem('tf_refresh_token');
    if (savedUser && savedToken) {
      const parsedUser = JSON.parse(savedUser);
      setUser(parsedUser);
      setToken(savedToken);
      setRefreshToken(savedRefresh);
      if (parsedUser.role === 'admin') {
        setActiveTab('admin');
      } else if (parsedUser.role === 'client') {
        setActiveTab('myProjects');
      } else {
        setActiveTab('browse');
      }
    }
  }, []);

  // API Request Helper
  const apiRequest = async (path, options = {}) => {
    options.headers = options.headers || {};
    if (token) {
      options.headers['Authorization'] = `Bearer ${token}`;
    }
    if (options.body && !(options.body instanceof FormData) && typeof options.body === 'object') {
      options.headers['Content-Type'] = 'application/json';
      options.body = JSON.stringify(options.body);
    }

    let res = await fetch(`${API_BASE}${path}`, options);

    if (res.status === 401) {
      // Try refresh
      const refreshed = await attemptTokenRefresh();
      if (refreshed) {
        options.headers['Authorization'] = `Bearer ${localStorage.getItem('tf_access_token')}`;
        res = await fetch(`${API_BASE}${path}`, options);
      } else {
        handleLogout(false);
        showToast('Your session has expired. Please sign in again.', 'error');
        throw new Error('Unauthorized');
      }
    }

    if (!res.ok) {
      const errData = await res.json().catch(() => ({}));
      throw new Error(errData.error || 'Request failed');
    }

    return res.json();
  };

  const attemptTokenRefresh = async () => {
    const savedRefresh = localStorage.getItem('tf_refresh_token');
    if (!savedRefresh) return false;

    try {
      const res = await fetch(`${API_BASE}/api/auth/refresh`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ refreshToken: savedRefresh }),
      });

      if (res.ok) {
        const data = await res.json();
        localStorage.setItem('tf_access_token', data.accessToken);
        setToken(data.accessToken);
        return true;
      }
    } catch (err) {
      console.error('Refresh token error:', err);
    }
    return false;
  };

  const handleLogout = (showMsg = true) => {
    const savedRefresh = localStorage.getItem('tf_refresh_token');
    if (savedRefresh) {
      fetch(`${API_BASE}/api/auth/logout`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ refreshToken: savedRefresh }),
      }).catch(err => console.error(err));
    }

    localStorage.removeItem('tf_access_token');
    localStorage.removeItem('tf_refresh_token');
    localStorage.removeItem('tf_user');
    setUser(null);
    setToken(null);
    setRefreshToken(null);
    setActiveTab('browse');
    if (showMsg) {
      showToast('Signed out successfully.', 'success');
    }
  };

  // Queries
  const { data: browseProjects = [], isLoading: isBrowseLoading } = useQuery({
    queryKey: ['browseProjects', search, statusFilter],
    queryFn: () => {
      let query = `/api/projects`;
      const params = [];
      if (search) params.push(`search=${encodeURIComponent(search)}`);
      if (statusFilter) params.push(`status=${statusFilter}`);
      if (params.length > 0) query += `?${params.join('&')}`;
      return apiRequest(query);
    },
    enabled: !!user,
  });

  const { data: myPostedProjects = [], isLoading: isMyPostedLoading } = useQuery({
    queryKey: ['myPostedProjects', user?.id],
    queryFn: () => apiRequest('/api/projects?myProjects=true'),
    enabled: !!user && user.role === 'client',
  });

  const { data: assignedProjects = [], isLoading: isAssignedLoading } = useQuery({
    queryKey: ['assignedProjects', user?.id],
    queryFn: () => apiRequest('/api/projects?assignedToMe=true'),
    enabled: !!user && user.role === 'freelancer',
  });

  const { data: myBidsProjects = [], isLoading: isMyBidsLoading } = useQuery({
    queryKey: ['myBidsProjects', user?.id],
    queryFn: () => apiRequest('/api/projects?biddedByMe=true'),
    enabled: !!user && user.role === 'freelancer',
  });

  const { data: projectDetail, isLoading: isDetailLoading } = useQuery({
    queryKey: ['projectDetail', selectedProjectId],
    queryFn: () => apiRequest(`/api/projects/${selectedProjectId}`),
    enabled: !!selectedProjectId,
  });

  const { data: adminUsers = [], isLoading: isAdminUsersLoading } = useQuery({
    queryKey: ['adminUsers'],
    queryFn: () => apiRequest('/api/admin/users'),
    enabled: !!user && user.role === 'admin',
  });

  // Mutations
  const loginMutation = useMutation({
    mutationFn: (credentials) => fetch(`${API_BASE}/api/auth/login`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(credentials),
    }).then(async res => {
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || 'Login failed');
      return data;
    }),
    onSuccess: (data) => {
      localStorage.setItem('tf_access_token', data.accessToken);
      localStorage.setItem('tf_refresh_token', data.refreshToken);
      localStorage.setItem('tf_user', JSON.stringify(data.user));
      setUser(data.user);
      setToken(data.accessToken);
      setRefreshToken(data.refreshToken);
      setLoginEmail('');
      setLoginPassword('');
      showToast('Signed in successfully.', 'success');
      if (data.user.role === 'admin') {
        setActiveTab('admin');
      } else if (data.user.role === 'client') {
        setActiveTab('myProjects');
      } else {
        setActiveTab('browse');
      }
    },
    onError: (err) => {
      showToast(err.message, 'error');
    },
  });

  const registerMutation = useMutation({
    mutationFn: (newUser) => fetch(`${API_BASE}/api/auth/register`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(newUser),
    }).then(async res => {
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || 'Registration failed');
      return data;
    }),
    onSuccess: (data) => {
      showToast(data.message, 'success');
      setRegFullName('');
      setRegEmail('');
      setRegPassword('');
      router.push(`/verify-email?email=${encodeURIComponent(data.email)}&otp=${data.otp}`);
    },
    onError: (err) => {
      showToast(err.message, 'error');
    },
  });

  const forgotPasswordMutation = useMutation({
    mutationFn: (reqBody) => fetch(`${API_BASE}/api/auth/forgot-password`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(reqBody),
    }).then(async res => {
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || 'Failed to request reset');
      return data;
    }),
    onSuccess: (data) => {
      showToast(data.message, 'success');
      setShowForgot(false);
      setForgotEmail('');
    },
    onError: (err) => {
      showToast(err.message, 'error');
    },
  });

  const postProjectMutation = useMutation({
    mutationFn: (project) => apiRequest('/api/projects', { method: 'POST', body: project }),
    onSuccess: () => {
      showToast('Project posted successfully.', 'success');
      queryClient.invalidateQueries({ queryKey: ['browseProjects'] });
      queryClient.invalidateQueries({ queryKey: ['myPostedProjects'] });
      setPostTitle('');
      setPostDescription('');
      setPostBudget('');
      setActiveTab('myProjects');
    },
    onError: (err) => showToast(err.message, 'error'),
  });

  const submitBidMutation = useMutation({
    mutationFn: (bid) => apiRequest(`/api/projects/${selectedProjectId}/bids`, { method: 'POST', body: bid }),
    onSuccess: () => {
      showToast('Bid placed successfully.', 'success');
      queryClient.invalidateQueries({ queryKey: ['projectDetail', selectedProjectId] });
      queryClient.invalidateQueries({ queryKey: ['myBidsProjects'] });
      setBidAmount('');
      setBidProposal('');
      setSelectedProjectId(null);
    },
    onError: (err) => showToast(err.message, 'error'),
  });

  const retractBidMutation = useMutation({
    mutationFn: (bidId) => apiRequest(`/api/bids/${bidId}`, { method: 'DELETE' }),
    onSuccess: () => {
      showToast('Bid retracted successfully.', 'success');
      queryClient.invalidateQueries({ queryKey: ['projectDetail', selectedProjectId] });
      queryClient.invalidateQueries({ queryKey: ['myBidsProjects'] });
      setSelectedProjectId(null);
    },
    onError: (err) => showToast(err.message, 'error'),
  });

  const acceptBidMutation = useMutation({
    mutationFn: (bidId) => apiRequest(`/api/projects/${selectedProjectId}/accept-bid`, { method: 'POST', body: { bidId } }),
    onSuccess: () => {
      showToast('Bid accepted and freelancer assigned.', 'success');
      queryClient.invalidateQueries({ queryKey: ['projectDetail', selectedProjectId] });
      queryClient.invalidateQueries({ queryKey: ['myPostedProjects'] });
      queryClient.invalidateQueries({ queryKey: ['browseProjects'] });
    },
    onError: (err) => showToast(err.message, 'error'),
  });

  const deliverWorkMutation = useMutation({
    mutationFn: () => apiRequest(`/api/projects/${selectedProjectId}/deliver`, { method: 'POST' }),
    onSuccess: () => {
      showToast('Work delivered successfully.', 'success');
      queryClient.invalidateQueries({ queryKey: ['projectDetail', selectedProjectId] });
      queryClient.invalidateQueries({ queryKey: ['assignedProjects'] });
    },
    onError: (err) => showToast(err.message, 'error'),
  });

  const completeProjectMutation = useMutation({
    mutationFn: () => apiRequest(`/api/projects/${selectedProjectId}/complete`, { method: 'POST' }),
    onSuccess: () => {
      showToast('Project completed successfully.', 'success');
      queryClient.invalidateQueries({ queryKey: ['projectDetail', selectedProjectId] });
      queryClient.invalidateQueries({ queryKey: ['myPostedProjects'] });
    },
    onError: (err) => showToast(err.message, 'error'),
  });

  const submitReviewMutation = useMutation({
    mutationFn: (review) => apiRequest('/api/reviews', { method: 'POST', body: review }),
    onSuccess: () => {
      showToast('Review submitted successfully.', 'success');
      queryClient.invalidateQueries({ queryKey: ['projectDetail', selectedProjectId] });
      setReviewComment('');
    },
    onError: (err) => showToast(err.message, 'error'),
  });

  const banUserMutation = useMutation({
    mutationFn: ({ userId, isBanned }) => apiRequest(`/api/admin/users/${userId}/ban`, { method: 'PUT', body: { isBanned } }),
    onSuccess: (data) => {
      showToast(data.message, 'success');
      queryClient.invalidateQueries({ queryKey: ['adminUsers'] });
    },
    onError: (err) => showToast(err.message, 'error'),
  });

  const handleBanToggle = (userId, fullName, isBanned) => {
    const action = isBanned ? 'ban' : 'unban';
    if (window.confirm(`Are you sure you want to ${action} user "${fullName}"?`)) {
      banUserMutation.mutate({ userId, isBanned });
    }
  };

  const handleSignoutClick = () => {
    if (window.confirm('Are you sure you want to sign out?')) {
      handleLogout();
    }
  };

  // Handlers
  const handleLoginSubmit = (e) => {
    e.preventDefault();
    loginMutation.mutate({ email: loginEmail, password: loginPassword });
  };

  const handleRegisterSubmit = (e) => {
    e.preventDefault();
    registerMutation.mutate({ fullName: regFullName, email: regEmail, password: regPassword, role: regRole });
  };

  const handleForgotSubmit = (e) => {
    e.preventDefault();
    forgotPasswordMutation.mutate({ email: forgotEmail });
  };

  const handlePostProjectSubmit = (e) => {
    e.preventDefault();
    postProjectMutation.mutate({ title: postTitle, description: postDescription, budget: postBudget });
  };

  const handleBidSubmit = (e) => {
    e.preventDefault();
    submitBidMutation.mutate({ amount: bidAmount, proposal: bidProposal });
  };

  const handleReviewSubmit = (e) => {
    e.preventDefault();
    submitReviewMutation.mutate({ projectId: selectedProjectId, rating: reviewRating, comment: reviewComment });
  };

  // Derived check: has current user bid on selected project?
  const myBid = user && projectDetail?.bids?.find(b => b.freelancerId === user.id);

  return (
    <div style={{ display: 'flex', flexDirection: 'column', minHeight: '100vh' }}>
      
      {/* Toast Notifications */}
      <div className="toast-container">
        {toasts.map(t => (
          <div key={t.id} className={`toast toast-${t.type}`}>
            <span>{t.message}</span>
            <button 
              onClick={() => setToasts(prev => prev.filter(x => x.id !== t.id))}
              style={{ background: 'transparent', border: 'none', cursor: 'pointer', fontWeight: 'bold', marginLeft: '15px' }}
            >
              &times;
            </button>
          </div>
        ))}
      </div>

      {/* Developer Setup & Admin Credentials Banner */}
      {!user && (
        <div style={{ display: 'flex', flexDirection: 'column' }}>
          <div className="admin-banner" style={{ background: '#eff6ff', borderBottom: '1px solid #bfdbfe', color: '#1e40af' }}>
            ⚙️ <strong>First-Time Setup:</strong> Copy <code>backend/.env.example</code> to <code>.env</code>, configure environment variables, and run <code>npx prisma db push</code> inside the <code>backend/</code> folder.
          </div>
          <div className="admin-banner">
            🔑 <strong>Test Admin Credentials:</strong> Email: <code>admin@taskforge.com</code> | Password: <code>adminpassword123</code>
          </div>
        </div>
      )}

      {/* Header Navigation */}
      <header>
        <div className="container nav-container">
          <div className="logo" onClick={() => {
            if (!user) {
              setActiveTab('browse');
            } else if (user.role === 'admin') {
              setActiveTab('admin');
            } else if (user.role === 'client') {
              setActiveTab('myProjects');
            } else {
              setActiveTab('browse');
            }
            setSelectedProjectId(null);
          }}>
            <div className="logo-icon">T</div>
            TaskForge
          </div>
          <div className="nav-links">
            {!user ? (
              <div>
                <button className="btn btn-secondary btn-sm" onClick={() => { setIsLoginView(true); setActiveTab('auth'); setShowForgot(false); }}>Sign In</button>
                <button className="btn btn-primary btn-sm" onClick={() => { setIsLoginView(false); setActiveTab('auth'); }} style={{ marginLeft: '10px' }}>Register</button>
              </div>
            ) : (
              <div style={{ display: 'flex', alignItems: 'center', gap: '15px' }}>
                <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'flex-end', lineHeight: '1.2' }}>
                  <span style={{ fontWeight: '600', color: 'var(--text-primary)' }}>{user.fullName}</span>
                  <span style={{ fontSize: '0.75rem', color: 'var(--text-secondary)' }}>{user.email}</span>
                </div>
                <span className={`badge badge-${user.role === 'admin' ? 'completed' : user.role === 'client' ? 'assigned' : 'open'}`}>
                  {user.role}
                </span>
                <button className="btn btn-secondary btn-sm" onClick={handleSignoutClick}>Sign Out</button>
              </div>
            )}
          </div>
        </div>
      </header>

      {/* Main Container */}
      <main className="container" style={{ flex: 1, paddingBottom: '50px' }}>
        
        {/* Landing Page (Logged Out) */}
        {!user && activeTab !== 'auth' && (
          <section style={{ textAlign: 'center', padding: '80px 0' }}>
            <h1 style={{ fontSize: '3.5rem', marginBottom: '20px', lineHeight: '1.2' }}>
              Where Top Talents and<br />Ambitious Projects Meet
            </h1>
            <p style={{ color: 'var(--text-secondary)', fontSize: '1.2rem', maxWidth: '600px', margin: '0 auto 35px auto' }}>
              Post projects, place competitive bids, hire verified freelancers, and build reviews. The complete professional marketplace platform.
            </p>
            <div>
              <button className="btn btn-primary" onClick={() => { setIsLoginView(false); setActiveTab('auth'); }}>
                Get Started Now
              </button>
            </div>
          </section>
        )}

        {/* Authentication Section */}
        {!user && activeTab === 'auth' && (
          <div style={{ maxWidth: '900px', margin: '40px auto 0 auto' }}>
            <div className="grid-2">
              
              {/* Login Card */}
              {isLoginView && !showForgot && (
                <div className="card">
                  <h2 style={{ marginBottom: '20px' }}>Welcome Back</h2>
                  <form onSubmit={handleLoginSubmit}>
                    <div className="form-group">
                      <label>Email Address</label>
                      <input 
                        type="email" 
                        className="form-control" 
                        value={loginEmail} 
                        onChange={(e) => setLoginEmail(e.target.value)} 
                        placeholder="you@example.com" 
                        required 
                      />
                    </div>
                    <div className="form-group">
                      <label>Password</label>
                      <input 
                        type="password" 
                        className="form-control" 
                        value={loginPassword} 
                        onChange={(e) => setLoginPassword(e.target.value)} 
                        placeholder="••••••••" 
                        required 
                      />
                      <div style={{ textAlign: 'right', marginTop: '6px' }}>
                        <a 
                          href="#" 
                          onClick={(e) => { e.preventDefault(); setShowForgot(true); }}
                          style={{ fontSize: '0.8rem', color: 'var(--color-primary)', textDecoration: 'none', fontWeight: '500' }}
                        >
                          Forgot Password?
                        </a>
                      </div>
                    </div>
                    <button type="submit" className="btn btn-primary" style={{ width: '100%' }} disabled={loginMutation.isPending}>
                      {loginMutation.isPending ? 'Signing In...' : 'Sign In'}
                    </button>
                  </form>
                  <p style={{ textAlign: 'center', marginTop: '15px', fontSize: '0.85rem', color: 'var(--text-secondary)' }}>
                    Don't have an account? <a href="#" onClick={(e) => { e.preventDefault(); setIsLoginView(false); }} style={{ color: 'var(--color-primary)' }}>Register here</a>
                  </p>
                </div>
              )}

              {/* Register Card */}
              {!isLoginView && (
                <div className="card">
                  <h2 style={{ marginBottom: '20px' }}>Create Account</h2>
                  <form onSubmit={handleRegisterSubmit}>
                    <div className="form-group">
                      <label>Full Name</label>
                      <input 
                        type="text" 
                        className="form-control" 
                        value={regFullName} 
                        onChange={(e) => setRegFullName(e.target.value)} 
                        placeholder="John Doe" 
                        required 
                      />
                    </div>
                    <div className="form-group">
                      <label>Email Address</label>
                      <input 
                        type="email" 
                        className="form-control" 
                        value={regEmail} 
                        onChange={(e) => setRegEmail(e.target.value)} 
                        placeholder="john@example.com" 
                        required 
                      />
                    </div>
                    <div className="form-group">
                      <label>Password (6+ characters)</label>
                      <input 
                        type="password" 
                        className="form-control" 
                        value={regPassword} 
                        onChange={(e) => setRegPassword(e.target.value)} 
                        placeholder="••••••••" 
                        required 
                        minLength={6}
                      />
                    </div>
                    <div className="form-group">
                      <label>Join As</label>
                      <div className="form-row">
                        <label style={{ display: 'flex', alignItems: 'center', gap: '8px', background: '#f8fafc', border: '1px solid var(--border-color)', padding: '10px', borderRadius: 'var(--radius-md)', cursor: 'pointer' }}>
                          <input 
                            type="radio" 
                            name="role" 
                            value="client" 
                            checked={regRole === 'client'} 
                            onChange={() => setRegRole('client')} 
                          /> Client
                        </label>
                        <label style={{ display: 'flex', alignItems: 'center', gap: '8px', background: '#f8fafc', border: '1px solid var(--border-color)', padding: '10px', borderRadius: 'var(--radius-md)', cursor: 'pointer' }}>
                          <input 
                            type="radio" 
                            name="role" 
                            value="freelancer" 
                            checked={regRole === 'freelancer'} 
                            onChange={() => setRegRole('freelancer')} 
                          /> Freelancer
                        </label>
                      </div>
                    </div>
                    <button type="submit" className="btn btn-primary" style={{ width: '100%' }} disabled={registerMutation.isPending}>
                      {registerMutation.isPending ? 'Creating Account...' : 'Create Account'}
                    </button>
                  </form>
                  <p style={{ textAlign: 'center', marginTop: '15px', fontSize: '0.85rem', color: 'var(--text-secondary)' }}>
                    Already have an account? <a href="#" onClick={(e) => { e.preventDefault(); setIsLoginView(true); }} style={{ color: 'var(--color-primary)' }}>Sign in here</a>
                  </p>
                </div>
              )}

              {/* Forgot Password View */}
              {isLoginView && showForgot && (
                <div className="card">
                  <h2 style={{ marginBottom: '15px' }}>Reset Password</h2>
                  <p style={{ color: 'var(--text-secondary)', marginBottom: '20px', fontSize: '0.9rem' }}>
                    Enter your email address and we'll email you a secure link to reset your password.
                  </p>
                  <form onSubmit={handleForgotSubmit}>
                    <div className="form-group">
                      <label>Email Address</label>
                      <input 
                        type="email" 
                        className="form-control" 
                        value={forgotEmail} 
                        onChange={(e) => setForgotEmail(e.target.value)} 
                        placeholder="you@example.com" 
                        required 
                      />
                    </div>
                    <button type="submit" className="btn btn-primary" style={{ width: '100%' }} disabled={forgotPasswordMutation.isPending}>
                      {forgotPasswordMutation.isPending ? 'Sending Link...' : 'Send Reset Link'}
                    </button>
                    <button type="button" className="btn btn-secondary" style={{ width: '100%', marginTop: '10px' }} onClick={() => setShowForgot(false)}>
                      Back to Sign In
                    </button>
                  </form>
                </div>
              )}

              {/* Dynamic Info Panel */}
              <div style={{ display: 'flex', flexDirection: 'column', justifyContent: 'center', padding: '20px' }}>
                <h3 style={{ marginBottom: '12px', color: 'var(--color-primary)' }}>Real Email Deliverability</h3>
                <p style={{ color: 'var(--text-secondary)', fontSize: '0.95rem', lineHeight: '1.6' }}>
                  TaskForge is configured with active Google SMTP servers. Upon registration or requesting a password reset, a link will be sent to the entered email address. 
                  Check your inbox (and spam folder) to complete verification!
                </p>
              </div>

            </div>
          </div>
        )}

        {/* Dashboard Section (Logged In) */}
        {user && (
          <div className="dashboard-layout">
            
            {/* Sidebar Navigation */}
            <aside className="sidebar">
              <div className="card" style={{ padding: '15px' }}>
                {user.role !== 'client' && (
                  <button 
                    className={`sidebar-btn ${activeTab === 'browse' ? 'active' : ''}`}
                    onClick={() => switchDashboardTab('browse')}
                  >
                    🔍 Browse Projects
                  </button>
                )}

                {user.role === 'client' && (
                  <button 
                    className={`sidebar-btn ${activeTab === 'myProjects' ? 'active' : ''}`}
                    onClick={() => switchDashboardTab('myProjects')}
                  >
                    💼 My Posted Projects
                  </button>
                )}

                {user.role === 'client' && (
                  <button 
                    className={`sidebar-btn ${activeTab === 'post' ? 'active' : ''}`}
                    onClick={() => switchDashboardTab('post')}
                  >
                    ➕ Post a Project
                  </button>
                )}

                {user.role === 'freelancer' && (
                  <button 
                    className={`sidebar-btn ${activeTab === 'myBids' ? 'active' : ''}`}
                    onClick={() => switchDashboardTab('myBids')}
                  >
                    ⚡ My Submitted Bids
                  </button>
                )}

                {user.role === 'freelancer' && (
                  <button 
                    className={`sidebar-btn ${activeTab === 'assigned' ? 'active' : ''}`}
                    onClick={() => switchDashboardTab('assigned')}
                  >
                    🛠️ Assigned Projects
                  </button>
                )}

                {user.role === 'admin' && (
                  <button 
                    className={`sidebar-btn ${activeTab === 'admin' ? 'active' : ''}`}
                    onClick={() => switchDashboardTab('admin')}
                  >
                    🛡️ User Moderation
                  </button>
                )}
              </div>
            </aside>

            {/* Dashboard Content Panes */}
            <section style={{ flex: 1 }}>
              
              {/* Browse Projects Tab */}
              {activeTab === 'browse' && (
                <div>
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '25px', flexWrap: 'wrap', gap: '15px' }}>
                    <h2>Browse Marketplace Projects</h2>
                    <div style={{ display: 'flex', gap: '10px' }}>
                      <input 
                        type="text" 
                        className="form-control" 
                        value={search} 
                        onChange={(e) => setSearch(e.target.value)} 
                        placeholder="Search project title..." 
                        style={{ width: '220px', padding: '8px 12px', fontSize: '0.9rem' }}
                      />
                      <select 
                        className="form-control" 
                        value={statusFilter} 
                        onChange={(e) => setStatusFilter(e.target.value)}
                        style={{ width: '140px', padding: '8px', fontSize: '0.9rem' }}
                      >
                        <option value="">All Status</option>
                        <option value="OPEN">Open</option>
                        <option value="ASSIGNED">Assigned</option>
                        <option value="DELIVERED">Delivered</option>
                        <option value="COMPLETED">Completed</option>
                      </select>
                    </div>
                  </div>

                  {isBrowseLoading ? (
                    <p style={{ color: 'var(--text-secondary)' }}>Loading projects...</p>
                  ) : (
                    <div className="projects-grid">
                      {browseProjects.length === 0 ? (
                        <p style={{ color: 'var(--text-muted)' }}>No projects posted yet.</p>
                      ) : (
                        browseProjects.map(proj => (
                          <div key={proj.id} className="card project-card" style={{ cursor: 'pointer' }} onClick={() => setSelectedProjectId(proj.id)}>
                            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: '8px' }}>
                              <h3 style={{ fontSize: '1.2rem' }}>{proj.title}</h3>
                              <span className={`badge badge-${proj.status.toLowerCase()}`}>{proj.status}</span>
                            </div>
                            <p style={{ color: 'var(--text-secondary)', fontSize: '0.88rem', overflow: 'hidden', display: '-webkit-box', WebkitLineClamp: 3, WebkitBoxOrient: 'vertical', flex: 1 }}>
                              {proj.description}
                            </p>
                            <div style={{ display: 'flex', justifyContent: 'space-between', borderTop: '1px solid var(--border-color)', paddingTop: '10px', marginTop: '15px', fontSize: '0.85rem' }}>
                              <span style={{ color: 'var(--text-secondary)' }}>By: <strong>{proj.client.fullName}</strong></span>
                              <span className="project-price">${proj.budget}</span>
                            </div>
                          </div>
                        ))
                      )}
                    </div>
                  )}
                </div>
              )}

              {/* My Posted Projects Tab */}
              {activeTab === 'myProjects' && (
                <div>
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '25px' }}>
                    <h2>My Posted Projects</h2>
                    {user.role === 'client' && (
                      <button className="btn btn-primary btn-sm" onClick={() => setActiveTab('post')}>Post New Project</button>
                    )}
                  </div>

                  {isMyPostedLoading ? (
                    <p style={{ color: 'var(--text-secondary)' }}>Loading my projects...</p>
                  ) : (
                    <div className="projects-grid">
                      {myPostedProjects.length === 0 ? (
                        <p style={{ color: 'var(--text-muted)' }}>You haven't posted any projects.</p>
                      ) : (
                        myPostedProjects.map(proj => (
                          <div key={proj.id} className="card project-card" style={{ cursor: 'pointer' }} onClick={() => setSelectedProjectId(proj.id)}>
                            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: '8px' }}>
                              <h3 style={{ fontSize: '1.2rem' }}>{proj.title}</h3>
                              <span className={`badge badge-${proj.status.toLowerCase()}`}>{proj.status}</span>
                            </div>
                            <p style={{ color: 'var(--text-secondary)', fontSize: '0.88rem', overflow: 'hidden', display: '-webkit-box', WebkitLineClamp: 3, WebkitBoxOrient: 'vertical', flex: 1 }}>
                              {proj.description}
                            </p>
                            <div style={{ display: 'flex', justifyContent: 'space-between', borderTop: '1px solid var(--border-color)', paddingTop: '10px', marginTop: '15px', fontSize: '0.85rem' }}>
                              <span style={{ color: 'var(--text-secondary)' }}>Bids: <strong>{proj._count?.bids || 0}</strong></span>
                              <span className="project-price">${proj.budget}</span>
                            </div>
                          </div>
                        ))
                      )}
                    </div>
                  )}
                </div>
              )}

              {/* Post Project Tab */}
              {activeTab === 'post' && (
                <div className="card" style={{ maxWidth: '650px' }}>
                  <h2 style={{ marginBottom: '20px' }}>Post a New Project</h2>
                  <form onSubmit={handlePostProjectSubmit}>
                    <div className="form-group">
                      <label>Project Title</label>
                      <input 
                        type="text" 
                        className="form-control" 
                        value={postTitle} 
                        onChange={(e) => setPostTitle(e.target.value)} 
                        placeholder="e.g. Develop REST API in Node.js" 
                        required 
                      />
                    </div>
                    <div className="form-group">
                      <label>Project Description</label>
                      <textarea 
                        className="form-control" 
                        rows="5" 
                        value={postDescription} 
                        onChange={(e) => setPostDescription(e.target.value)} 
                        placeholder="Provide detailed description of requirements..." 
                        required 
                      />
                    </div>
                    <div className="form-group">
                      <label>Budget (USD)</label>
                      <input 
                        type="number" 
                        className="form-control" 
                        value={postBudget} 
                        onChange={(e) => setPostBudget(e.target.value)} 
                        placeholder="500" 
                        required 
                        min="1" 
                      />
                    </div>
                    <button type="submit" className="btn btn-primary" style={{ width: '100%' }} disabled={postProjectMutation.isPending}>
                      {postProjectMutation.isPending ? 'Publishing...' : 'Publish Project'}
                    </button>
                  </form>
                </div>
              )}

              {/* My Submitted Bids Tab (Freelancer) */}
              {activeTab === 'myBids' && (
                <div>
                  <h2 style={{ marginBottom: '25px' }}>My Submitted Bids</h2>
                  {isMyBidsLoading ? (
                    <p style={{ color: 'var(--text-secondary)' }}>Loading bids...</p>
                  ) : (
                    <div className="projects-grid">
                      {myBidsProjects.length === 0 ? (
                        <p style={{ color: 'var(--text-muted)' }}>You haven't submitted any bids yet.</p>
                      ) : (
                        myBidsProjects.map(proj => (
                          <div key={proj.id} className="card project-card" style={{ cursor: 'pointer' }} onClick={() => setSelectedProjectId(proj.id)}>
                            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: '8px' }}>
                              <h3 style={{ fontSize: '1.2rem' }}>{proj.title}</h3>
                              <span className={`badge badge-${proj.status.toLowerCase()}`}>{proj.status}</span>
                            </div>
                            <p style={{ color: 'var(--text-secondary)', fontSize: '0.88rem', overflow: 'hidden', display: '-webkit-box', WebkitLineClamp: 3, WebkitBoxOrient: 'vertical', flex: 1 }}>
                              {proj.description}
                            </p>
                            <div style={{ display: 'flex', justifyContent: 'space-between', borderTop: '1px solid var(--border-color)', paddingTop: '10px', marginTop: '15px', fontSize: '0.85rem' }}>
                              <span style={{ color: 'var(--text-secondary)' }}>Client: <strong>{proj.client.fullName}</strong></span>
                              <span className="project-price">${proj.budget}</span>
                            </div>
                          </div>
                        ))
                      )}
                    </div>
                  )}
                </div>
              )}

              {/* Assigned Projects Tab (Freelancer) */}
              {activeTab === 'assigned' && (
                <div>
                  <h2 style={{ marginBottom: '25px' }}>Assigned Work Projects</h2>
                  {isAssignedLoading ? (
                    <p style={{ color: 'var(--text-secondary)' }}>Loading assigned projects...</p>
                  ) : (
                    <div className="projects-grid">
                      {assignedProjects.length === 0 ? (
                        <p style={{ color: 'var(--text-muted)' }}>No assigned projects.</p>
                      ) : (
                        assignedProjects.map(proj => (
                          <div key={proj.id} className="card project-card" style={{ cursor: 'pointer' }} onClick={() => setSelectedProjectId(proj.id)}>
                            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: '8px' }}>
                              <h3 style={{ fontSize: '1.2rem' }}>{proj.title}</h3>
                              <span className={`badge badge-${proj.status.toLowerCase()}`}>{proj.status}</span>
                            </div>
                            <p style={{ color: 'var(--text-secondary)', fontSize: '0.88rem', overflow: 'hidden', display: '-webkit-box', WebkitLineClamp: 3, WebkitBoxOrient: 'vertical', flex: 1 }}>
                              {proj.description}
                            </p>
                            <div style={{ display: 'flex', justifyContent: 'space-between', borderTop: '1px solid var(--border-color)', paddingTop: '10px', marginTop: '15px', fontSize: '0.85rem' }}>
                              <span style={{ color: 'var(--text-secondary)' }}>Client: <strong>{proj.client.fullName}</strong></span>
                              <span className="project-price">${proj.budget}</span>
                            </div>
                          </div>
                        ))
                      )}
                    </div>
                  )}
                </div>
              )}

              {/* Admin Moderation Tab */}
              {activeTab === 'admin' && (
                <div>
                  <h2 style={{ marginBottom: '20px' }}>User Moderation Panel</h2>
                  {isAdminUsersLoading ? (
                    <p style={{ color: 'var(--text-secondary)' }}>Loading users...</p>
                  ) : (
                    <div className="card" style={{ padding: 0, overflowX: 'auto' }}>
                      <table className="custom-table">
                        <thead>
                          <tr>
                            <th>Name</th>
                            <th>Email</th>
                            <th>Role</th>
                            <th>Status</th>
                            <th>Actions</th>
                          </tr>
                        </thead>
                        <tbody>
                          {adminUsers.map(u => (
                            <tr key={u.id}>
                              <td><strong>{u.fullName}</strong></td>
                              <td>{u.email}</td>
                              <td><span className="badge badge-role">{u.role}</span></td>
                              <td>
                                {u.isBanned ? (
                                  <span className="badge badge-danger">Banned</span>
                                ) : u.isVerified ? (
                                  <span className="badge badge-open">Verified</span>
                                ) : (
                                  <span className="badge" style={{ background: '#e2e8f0', color: '#64748b' }}>Unverified</span>
                                )}
                              </td>
                              <td>
                                {u.role === 'admin' ? (
                                  <span style={{ color: 'var(--text-muted)', fontSize: '0.8rem' }}>Immutable</span>
                                ) : u.isBanned ? (
                                  <button className="btn btn-secondary btn-sm" onClick={() => handleBanToggle(u.id, u.fullName, false)}>Unban</button>
                                ) : (
                                  <button className="btn btn-danger btn-sm" onClick={() => handleBanToggle(u.id, u.fullName, true)}>Ban</button>
                                )}
                              </td>
                            </tr>
                          ))}
                        </tbody>
                      </table>
                    </div>
                  )}
                </div>
              )}

            </section>
          </div>
        )}

      </main>

      {/* Project Details Modal */}
      {selectedProjectId && (
        <div className="modal-overlay" onClick={() => setSelectedProjectId(null)}>
          <div className="modal-content" onClick={(e) => e.stopPropagation()}>
            {isDetailLoading ? (
              <p>Loading project details...</p>
            ) : (
              projectDetail && (
                <div style={{ display: 'flex', flexDirection: 'column', gap: '20px' }}>
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                    <h2>{projectDetail.title}</h2>
                    <button 
                      onClick={() => setSelectedProjectId(null)}
                      style={{ background: 'transparent', border: 'none', cursor: 'pointer', fontSize: '1.5rem', fontWeight: 'bold' }}
                    >
                      &times;
                    </button>
                  </div>

                  <div>
                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '8px' }}>
                      <span className={`badge badge-${projectDetail.status.toLowerCase()}`}>{projectDetail.status}</span>
                      <span className="project-price" style={{ fontSize: '1.4rem' }}>${projectDetail.budget}</span>
                    </div>
                    <p style={{ fontSize: '0.88rem', color: 'var(--text-secondary)' }}>
                      Posted by: <strong>{projectDetail.client.fullName}</strong> ({projectDetail.client.email})
                      {projectDetail.freelancer && (
                        <span> | Assigned to: <strong>{projectDetail.freelancer.fullName}</strong></span>
                      )}
                    </p>
                  </div>

                  <div>
                    <h4 style={{ marginBottom: '6px' }}>Project Description</h4>
                    <p style={{ color: 'var(--text-secondary)', fontSize: '0.95rem', whiteSpace: 'pre-line' }}>{projectDetail.description}</p>
                  </div>

                  {/* 1. Bid Submission Form (Freelancer only, open projects) */}
                  {user && user.role === 'freelancer' && projectDetail.status === 'OPEN' && (
                    <div style={{ borderTop: '1px solid var(--border-color)', paddingTop: '15px' }}>
                      <h4 style={{ marginBottom: '12px' }}>{myBid ? 'Update Your Bid' : 'Place a Bid'}</h4>
                      <form onSubmit={handleBidSubmit}>
                        <div className="form-group">
                          <label>Bid Amount (USD)</label>
                          <input 
                            type="number" 
                            className="form-control" 
                            value={bidAmount} 
                            onChange={(e) => setBidAmount(e.target.value)} 
                            placeholder={myBid ? myBid.amount : '800'} 
                            required 
                            min="1" 
                          />
                        </div>
                        <div className="form-group">
                          <label>Proposal Message</label>
                          <textarea 
                            className="form-control" 
                            rows="3" 
                            value={bidProposal} 
                            onChange={(e) => setBidProposal(e.target.value)} 
                            placeholder={myBid ? myBid.proposal : 'Detail your expertise and delivery timeline...'} 
                            required 
                          />
                        </div>
                        <div style={{ display: 'flex', gap: '10px' }}>
                          <button type="submit" className="btn btn-primary" style={{ flex: 1 }} disabled={submitBidMutation.isPending}>
                            {myBid ? 'Update Bid' : 'Submit Bid'}
                          </button>
                          {myBid && (
                            <button 
                              type="button" 
                              className="btn btn-danger" 
                              onClick={() => retractBidMutation.mutate(myBid.id)}
                              disabled={retractBidMutation.isPending}
                            >
                              Retract Bid
                            </button>
                          )}
                        </div>
                      </form>
                    </div>
                  )}

                  {/* 2. Bids Listing (Client Owner / Admin only, open projects) */}
                  {user && (projectDetail.clientId === user.id || user.role === 'admin') && projectDetail.status === 'OPEN' && (
                    <div style={{ borderTop: '1px solid var(--border-color)', paddingTop: '15px' }}>
                      <h4 style={{ marginBottom: '12px' }}>Submitted Bids</h4>
                      {projectDetail.bids?.length === 0 ? (
                        <p style={{ color: 'var(--text-muted)', fontSize: '0.9rem' }}>No bids placed yet.</p>
                      ) : (
                        projectDetail.bids?.map(b => (
                          <div key={b.id} className="bid-item">
                            <div style={{ flex: 1, marginRight: '15px' }}>
                              <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '4px' }}>
                                <strong>{b.freelancer.fullName}</strong>
                                <span style={{ color: 'var(--color-success)', fontWeight: 'bold' }}>${b.amount}</span>
                              </div>
                              <p style={{ fontSize: '0.85rem', color: 'var(--text-secondary)' }}>{b.proposal}</p>
                            </div>
                            {projectDetail.clientId === user.id && (
                              <button className="btn btn-primary btn-sm" onClick={() => acceptBidMutation.mutate(b.id)}>
                                Accept Bid
                              </button>
                            )}
                          </div>
                        ))
                      )}
                    </div>
                  )}

                  {/* 3. Freelancer Action: Submit Work (Assigned freelancer only) */}
                  {user && projectDetail.freelancerId === user.id && projectDetail.status === 'ASSIGNED' && (
                    <div style={{ borderTop: '1px solid var(--border-color)', paddingTop: '15px', textAlign: 'center' }}>
                      <h4 style={{ marginBottom: '10px' }}>Submit Deliverables</h4>
                      <p style={{ color: 'var(--text-secondary)', fontSize: '0.9rem', marginBottom: '15px' }}>You have completed the work? Send it to the client for review.</p>
                      <button className="btn btn-primary" onClick={() => deliverWorkMutation.mutate()}>
                        Deliver Work
                      </button>
                    </div>
                  )}

                  {/* 4. Client Action: Mark Complete (Client owner only, assigned or delivered) */}
                  {user && projectDetail.clientId === user.id && (projectDetail.status === 'ASSIGNED' || projectDetail.status === 'DELIVERED') && (
                    <div style={{ borderTop: '1px solid var(--border-color)', paddingTop: '15px', textAlign: 'center' }}>
                      <h4 style={{ marginBottom: '10px' }}>Review & Close Project</h4>
                      <p style={{ color: 'var(--text-secondary)', fontSize: '0.9rem', marginBottom: '15px' }}>
                        {projectDetail.status === 'DELIVERED' 
                          ? 'The freelancer has delivered the work. Verify and mark as completed.' 
                          : 'Mark the project as completed when work is done.'}
                      </p>
                      <button className="btn btn-primary" onClick={() => completeProjectMutation.mutate()}>
                        Mark Completed
                      </button>
                    </div>
                  )}

                  {/* 5. Reviews List and Review submission (Completed projects) */}
                  {projectDetail.status === 'COMPLETED' && (
                    <div style={{ borderTop: '1px solid var(--border-color)', paddingTop: '15px' }}>
                      <h4 style={{ marginBottom: '10px' }}>Reviews & Feedback</h4>
                      {projectDetail.reviews?.length === 0 ? (
                        <p style={{ color: 'var(--text-muted)', fontSize: '0.9rem' }}>No reviews left yet.</p>
                      ) : (
                        <div style={{ display: 'flex', flexDirection: 'column', gap: '10px', marginBottom: '20px' }}>
                          {projectDetail.reviews?.map(r => (
                            <div key={r.id} style={{ borderBottom: '1px solid var(--border-color)', paddingBottom: '8px' }}>
                              <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '4px' }}>
                                <span style={{ color: 'var(--color-accent)', fontWeight: 'bold' }}>{'★'.repeat(r.rating) + '☆'.repeat(5-r.rating)}</span>
                                <span style={{ fontSize: '0.75rem', color: 'var(--text-muted)' }}>{new Date(r.createdAt).toLocaleDateString()}</span>
                              </div>
                              <p style={{ fontSize: '0.88rem', color: 'var(--text-secondary)' }}>{r.comment}</p>
                            </div>
                          ))}
                        </div>
                      )}

                      {/* Write Review Form */}
                      {user && (projectDetail.clientId === user.id || projectDetail.freelancerId === user.id) && 
                        !projectDetail.reviews?.some(r => r.reviewerId === user.id) && (
                          <form onSubmit={handleReviewSubmit}>
                            <h4 style={{ marginBottom: '10px' }}>Leave Feedback</h4>
                            <div className="form-group">
                              <label>Rating</label>
                              <div style={{ display: 'flex', gap: '5px' }}>
                                {[1, 2, 3, 4, 5].map(star => (
                                  <button 
                                    key={star} 
                                    type="button" 
                                    className={`star-btn ${reviewRating >= star ? 'active' : ''}`}
                                    onClick={() => setReviewRating(star)}
                                  >
                                    ★
                                  </button>
                                ))}
                              </div>
                            </div>
                            <div className="form-group">
                              <label>Comments</label>
                              <textarea 
                                className="form-control" 
                                rows="3" 
                                value={reviewComment} 
                                onChange={(e) => setReviewComment(e.target.value)} 
                                placeholder="Describe your experience working together..." 
                                required 
                              />
                            </div>
                            <button type="submit" className="btn btn-primary btn-sm" disabled={submitReviewMutation.isPending}>
                              Submit Review
                            </button>
                          </form>
                      )}
                    </div>
                  )}

                </div>
              )
            )}
          </div>
        </div>
      )}

    </div>
  );

  function switchDashboardTab(tab) {
    setActiveTab(tab);
    setSelectedProjectId(null);
  }
}
