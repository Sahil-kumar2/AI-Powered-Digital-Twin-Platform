import React from 'react';
import { render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { describe, it, beforeEach, expect, vi } from 'vitest';

const pushMock = vi.fn();
const loginMock = vi.fn();
const registerMock = vi.fn();

vi.mock('next/navigation', () => ({
    useRouter: () => ({ push: pushMock }),
}));

vi.mock('next/link', () => ({
    default: ({ children, href }: any) => <a href={href}>{children}</a>,
}));

vi.mock('@/lib/api', () => ({
    auth: {
        login: (...args: any[]) => loginMock(...args),
        register: (...args: any[]) => registerMock(...args),
    },
}));

import LoginPage from '@/app/login/page';

describe('LoginPage smoke', () => {
    beforeEach(() => {
        loginMock.mockReset();
        registerMock.mockReset();
        pushMock.mockReset();
        localStorage.clear();
    });

    it('signs in and redirects to dashboard', async () => {
        loginMock.mockResolvedValue({
            token: 'token-1',
            user: { id: 'u-1', email: 'engineer@example.com', name: 'Engineer' },
        });

        render(<LoginPage />);

        await userEvent.type(screen.getByPlaceholderText('you@company.com'), 'engineer@example.com');
        await userEvent.type(screen.getByPlaceholderText('Password'), 'secret123');
        await userEvent.click(screen.getByRole('button', { name: /sign in/i }));

        await waitFor(() => {
            expect(loginMock).toHaveBeenCalledWith('engineer@example.com', 'secret123');
            expect(pushMock).toHaveBeenCalledWith('/dashboard');
        });

        expect(localStorage.getItem('token')).toBe('token-1');
    });
});
