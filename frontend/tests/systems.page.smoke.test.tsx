import React from 'react';
import { render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { describe, it, beforeEach, expect, vi } from 'vitest';

const listMock = vi.fn();
const createMock = vi.fn();
const deleteMock = vi.fn();

vi.mock('next/link', () => ({
    default: ({ children, href }: any) => <a href={href}>{children}</a>,
}));

vi.mock('@/lib/api', () => ({
    systems: {
        list: (...args: any[]) => listMock(...args),
        create: (...args: any[]) => createMock(...args),
        delete: (...args: any[]) => deleteMock(...args),
    },
}));

import SystemsPage from '@/app/dashboard/systems/page';

describe('SystemsPage smoke', () => {
    beforeEach(() => {
        listMock.mockReset();
        createMock.mockReset();
        deleteMock.mockReset();

        listMock
            .mockResolvedValueOnce([])
            .mockResolvedValueOnce([
                {
                    id: 'sys-1',
                    name: 'HVAC Twin',
                    description: 'Line A',
                    createdAt: new Date().toISOString(),
                    updatedAt: new Date().toISOString(),
                },
            ]);
        createMock.mockResolvedValue({ id: 'sys-1' });
    });

    it('creates a system and exposes open builder action', async () => {
        render(<SystemsPage />);

        await userEvent.click(screen.getByRole('button', { name: /new system/i }));
        await userEvent.type(screen.getByPlaceholderText(/system name/i), 'HVAC Twin');
        await userEvent.click(screen.getByRole('button', { name: /^create$/i }));

        await waitFor(() => {
            expect(createMock).toHaveBeenCalledWith('HVAC Twin', '');
            expect(listMock).toHaveBeenCalledTimes(2);
        });

        const openBuilder = await screen.findByRole('link', { name: /open builder/i });
        expect(openBuilder).toHaveAttribute('href', '/dashboard/systems/sys-1/builder');
    });
});
