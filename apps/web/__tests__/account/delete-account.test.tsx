import React from 'react';
import { fireEvent, render, screen, waitFor } from '@testing-library/react';
import { DeleteAccountSection } from '@/components/account/DeleteAccountSection';
import { authApi } from '@/lib/api/auth';

const replace = jest.fn();
jest.mock('next/navigation', () => ({ useRouter: () => ({ replace, push: jest.fn(), prefetch: jest.fn() }) }));
jest.mock('../../src/lib/api/auth', () => ({ authApi: { deleteAccount: jest.fn(), sendOtp: jest.fn() } }));

describe('DeleteAccountSection', () => {
  beforeEach(() => jest.clearAllMocks());

  it('needs the password AND the explicit acknowledgement before it can submit', async () => {
    (authApi.deleteAccount as jest.Mock).mockResolvedValue({});
    render(<DeleteAccountSection />);
    fireEvent.click(screen.getByRole('button', { name: 'أريد حذف حسابي' }));

    const confirm = screen.getByRole('button', { name: 'احذف حسابي' });
    expect(confirm).toBeDisabled();
    fireEvent.change(screen.getByLabelText('كلمة المرور الحالية'), { target: { value: 'secret-pass' } });
    expect(confirm).toBeDisabled();
    fireEvent.click(screen.getByRole('checkbox'));
    expect(confirm).toBeEnabled();

    fireEvent.click(confirm);
    await waitFor(() => expect(authApi.deleteAccount).toHaveBeenCalledWith({ password: 'secret-pass' }));
    expect(replace).toHaveBeenCalledWith('/?account=deleted');
  });

  it('offers an SMS code only when the account has a phone, and sends it to that phone', async () => {
    (authApi.sendOtp as jest.Mock).mockResolvedValue({});
    render(<DeleteAccountSection phone="+905321234567" />);
    fireEvent.click(screen.getByRole('button', { name: 'أريد حذف حسابي' }));
    fireEvent.click(screen.getByLabelText('برمز يصل إلى هاتفي'));
    fireEvent.click(screen.getByRole('button', { name: 'أرسل رمز التحقق' }));
    await waitFor(() => expect(authApi.sendOtp).toHaveBeenCalledWith('+905321234567'));
  });

  it('shows the server error and does not leave the page', async () => {
    (authApi.deleteAccount as jest.Mock).mockRejectedValue(new Error('x'));
    render(<DeleteAccountSection />);
    fireEvent.click(screen.getByRole('button', { name: 'أريد حذف حسابي' }));
    fireEvent.change(screen.getByLabelText('كلمة المرور الحالية'), { target: { value: 'wrong' } });
    fireEvent.click(screen.getByRole('checkbox'));
    fireEvent.click(screen.getByRole('button', { name: 'احذف حسابي' }));
    expect(await screen.findByRole('alert')).toBeInTheDocument();
    expect(replace).not.toHaveBeenCalled();
  });
});
