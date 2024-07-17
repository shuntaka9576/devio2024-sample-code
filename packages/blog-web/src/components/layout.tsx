import { Button } from '@/components/ui/button';
import {
  Dialog,
  DialogContent,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import {
  startAuthentication,
  startRegistration,
} from '@simplewebauthn/browser';
import type { PublicKeyCredentialCreationOptionsJSON } from '@simplewebauthn/types';
import Link from 'next/link';
import { useEffect, useState } from 'react';
import type { ReactNode } from 'react';

const API_BASE_URL = process.env.NEXT_PUBLIC_API_BASE_URL;

interface LayoutProps {
  children: ReactNode;
}

export default function Layout({ children }: LayoutProps) {
  const [isSignUpModalOpen, setIsSignUpModalOpen] = useState(false);
  const [username, setUsername] = useState('');
  const [status, setStatus] = useState('');
  const [isLoggedIn, setIsLoggedIn] = useState(false);
  const [user, setUser] = useState<{ userName: string } | null>(null);

  useEffect(() => {
    checkLoginStatus();
  }, []);

  const checkLoginStatus = async () => {
    try {
      const response = await fetch(`${API_BASE_URL}/auth/session`, {
        credentials: 'include',
      });
      const data = await response.json();
      setIsLoggedIn(data.isLoggedIn);
      setUser(data.user || null);
    } catch (error) {
      console.error('セッションチェックエラー:', error);
    }
  };

  const handleSignUp = async (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    if (!username) {
      setStatus('ユーザー名を入力してください。');
      return;
    }
    try {
      setStatus('登録処理中...');
      const resp = await fetch(
        `${API_BASE_URL}/auth/generate-registration-options`,
        {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ userName: username }),
          credentials: 'include',
        }
      );
      const opts: PublicKeyCredentialCreationOptionsJSON = await resp.json();

      const attResp = await startRegistration(opts);

      const verificationResp = await fetch(
        `${API_BASE_URL}/auth/verify-registration`,
        {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(attResp),
          credentials: 'include',
        }
      );
      const verificationJSON = await verificationResp.json();

      if (verificationJSON.verified) {
        setStatus('PassKey登録成功！');
        setIsSignUpModalOpen(false);
        await checkLoginStatus(); // 登録後にログイン状態を確認
      } else {
        setStatus('PassKey登録失敗。もう一度お試しください。');
      }
    } catch (error) {
      console.error('Registration error:', error);
      setStatus(
        `エラー: ${error instanceof Error ? error.message : String(error)}`
      );
    }
  };

  const handleLogin = async () => {
    try {
      setStatus('ログイン処理中...');
      const resp = await fetch(
        `${API_BASE_URL}/auth/generate-authentication-options`,
        {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          credentials: 'include',
        }
      );
      const opts = await resp.json();
      const asseResp = await startAuthentication(opts);

      const verificationResp = await fetch(
        `${API_BASE_URL}/auth/verify-authentication`,
        {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(asseResp),
          credentials: 'include',
        }
      );
      const verificationJSON = await verificationResp.json();

      if (verificationJSON.verified) {
        setStatus('ログイン成功！');
        await checkLoginStatus(); // ログイン後に状態を更新
      } else {
        setStatus('ログイン失敗。もう一度お試しください。');
      }
    } catch (error) {
      console.error('Login error:', error);
      setStatus(
        `エラー: ${error instanceof Error ? error.message : String(error)}`
      );
    }
  };

  const handleLogout = async () => {
    try {
      const response = await fetch(`${API_BASE_URL}/auth/logout`, {
        method: 'POST',
        credentials: 'include',
      });
      if (response.ok) {
        setIsLoggedIn(false);
        setUser(null);
        setStatus('ログアウトしました。');
      } else {
        setStatus('ログアウトに失敗しました。');
      }
    } catch (error) {
      console.error('Logout error:', error);
      setStatus('ログアウトエラーが発生しました。');
    }
  };

  return (
    <div className="min-h-screen bg-gray-100 flex flex-col">
      <header className="bg-white shadow-sm">
        <nav className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 h-16 flex items-center justify-between">
          <Link href="/" className="font-bold text-xl">
            ブログプロトタイピング
          </Link>
          <div className="space-x-4">
            {isLoggedIn ? (
              <>
                <span>ログイン中(userName: {user?.userName})</span>
                <Button onClick={handleLogout}>Logout</Button>
              </>
            ) : (
              <>
                <Button
                  variant="outline"
                  onClick={() => setIsSignUpModalOpen(true)}
                >
                  Sign Up
                </Button>
                <Button onClick={handleLogin}>Login</Button>
              </>
            )}
          </div>
        </nav>
      </header>
      <main className="flex-grow container mx-auto px-4 sm:px-6 lg:px-8 py-8">
        {children}
        {status && <p className="mt-2 text-sm text-center">{status}</p>}
      </main>
      <footer className="bg-white border-t">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 h-16 flex items-center justify-center">
          <p>&copy; 2024 Your Company Name</p>
        </div>
      </footer>

      <Dialog open={isSignUpModalOpen} onOpenChange={setIsSignUpModalOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>新規登録</DialogTitle>
          </DialogHeader>
          <form onSubmit={handleSignUp}>
            <div className="space-y-4">
              <div className="space-y-2">
                <Label htmlFor="username">ユーザー名</Label>
                <Input
                  id="username"
                  value={username}
                  onChange={(e) => setUsername(e.target.value)}
                  placeholder="ユーザー名を入力"
                />
              </div>
              <DialogFooter>
                <Button type="submit">登録</Button>
              </DialogFooter>
            </div>
          </form>
        </DialogContent>
      </Dialog>
    </div>
  );
}
