import React from 'react';
import { render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { describe, it, beforeEach, expect, vi } from 'vitest';

const systemsListMock = vi.fn();
const alertsListMock = vi.fn();
const resolveMock = vi.fn();
const ackMock = vi.fn();

vi.mock('@/lib/api', () => ({
    systems: {
        list: (...args: any[]) => systemsListMock(...args),
    },
    alerts: {
        list: (...args: any[]) => alertsListMock(...args),
        resolve: (...args: any[]) => resolveMock(...args),
        acknowledge: (...args: any[]) => ackMock(...args),
    },
}));

import AlertsPage from '@/app/dashboard/alerts/page';

describe('AlertsPage smoke', () => {
    beforeEach(() => {
        systemsListMock.mockReset();
        alertsListMock.mockReset();
        resolveMock.mockReset();
        ackMock.mockReset();

        systemsListMock.mockResolvedValue([{ id: 'sys-1', name: 'HVAC Twin' }]);
        alertsListMock
            .mockResolvedValueOnce([
                {
                    id: 'a-1',
                    systemId: 'sys-1',
                    ruleId: null,
                    componentId: null,
                    severity: 'warning',
                    message: 'Temp high',
                    status: 'active',
                    createdAt: new Date().toISOString(),
                    resolvedAt: null,
                },
            ])
            .mockResolvedValueOnce([
                {
                    id: 'a-1',
                    systemId: 'sys-1',
                    ruleId: null,
                    componentId: null,
                    severity: 'warning',
                    message: 'Temp high',
                    status: 'resolved',
                    createdAt: new Date().toISOString(),
                    resolvedAt: new Date().toISOString(),
                },
            ]);
        resolveMock.mockResolvedValue({});
    });

    it('resolves an active alert', async () => {
        render(<AlertsPage />);

        const resolveButton = await screen.findByRole('button', { name: /resolve/i });
        await userEvent.click(resolveButton);

        await waitFor(() => {
            expect(resolveMock).toHaveBeenCalledWith('a-1');
            expect(alertsListMock).toHaveBeenCalledTimes(2);
        });

        const resolvedBadges = await screen.findAllByText(/resolved/i);
        expect(resolvedBadges.length).toBeGreaterThan(0);
    });
});
