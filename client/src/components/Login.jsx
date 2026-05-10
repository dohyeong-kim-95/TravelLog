import { useState } from 'react';
import { supabase } from '../lib/supabase.js';
import styles from './Login.module.css';

export default function Login() {
  const [email, setEmail]       = useState('');
  const [password, setPassword] = useState('');
  const [error, setError]       = useState('');
  const [loading, setLoading]   = useState(false);

  const handleSubmit = async (e) => {
    e.preventDefault();
    setError('');
    setLoading(true);

    const { error: authError } = await supabase.auth.signInWithPassword({ email, password });

    if (authError) {
      setError('이메일 또는 비밀번호가 틀렸습니다 😢');
    }
    // success: onAuthStateChange in App.jsx will handle the redirect
    setLoading(false);
  };

  return (
    <div className={styles.page}>
      <div className={styles.card}>
        <div className={styles.emoji}>🗺️</div>
        <h1 className={styles.title}>우리 여행 지도</h1>
        <p className={styles.subtitle}>둘이서 함께 색칠하는 대한민국 지도</p>

        <form onSubmit={handleSubmit} className={styles.form}>
          <div className={styles.field}>
            <label className={styles.label}>이메일</label>
            <input
              type="email"
              placeholder="이메일 주소"
              value={email}
              onChange={e => setEmail(e.target.value)}
              required
              autoFocus
            />
          </div>

          <div className={styles.field}>
            <label className={styles.label}>비밀번호</label>
            <input
              type="password"
              placeholder="비밀번호"
              value={password}
              onChange={e => setPassword(e.target.value)}
              required
            />
          </div>

          {error && <p className={styles.error}>{error}</p>}

          <button type="submit" className={styles.btn} disabled={loading}>
            {loading ? '로그인 중...' : '입장하기 ✨'}
          </button>
        </form>
      </div>
    </div>
  );
}
