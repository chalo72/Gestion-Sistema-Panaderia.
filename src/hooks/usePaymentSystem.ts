import { useState, useCallback } from 'react';
import type { Payment, CreditSale, EWallet, PaymentMethod } from '@/types/payment-system';

interface UsePaymentSystemReturn {
  payments: Payment[];
  creditSales: CreditSale[];
  ewallets: Map<string, EWallet>;
  
  // Pagos
  processPayment: (payment: Omit<Payment, 'id' | 'processedAt'>) => Promise<Payment>;
  getPaymentStatus: (transactionId: string) => Payment['status'] | null;
  
  // Crédito
  createCreditSale: (customerId: string, saleId: string, amount: number, days: number) => Promise<CreditSale>;
  processCreditPayment: (creditSaleId: string, paymentAmount: number) => Promise<void>;
  getCreditSalesForCustomer: (customerId: string) => CreditSale[];
  
  // E-Wallet
  createEWallet: (customerId: string, initialBalance?: number) => Promise<EWallet>;
  topUpEWallet: (customerId: string, amount: number) => Promise<void>;
  getEWalletBalance: (customerId: string) => number | null;
  chargeEWallet: (customerId: string, amount: number) => Promise<boolean>;
  
  // Estadísticas
  getTotalPayments: () => number;
  getPaymentsByMethod: (method: PaymentMethod) => number;
  getPendingCreditAmount: () => number;
}

export function usePaymentSystem(): UsePaymentSystemReturn {
  const [payments, setPayments] = useState<Payment[]>([]);
  const [creditSales, setCreditSales] = useState<CreditSale[]>([]);
  const [ewallets, setEwallets] = useState<Map<string, EWallet>>(new Map());

  // 💳 Procesar pago
  const processPayment = useCallback(async (paymentData: Omit<Payment, 'id' | 'processedAt'>) => {
    const payment: Payment = {
      ...paymentData,
      id: `pay_${Date.now()}`,
      processedAt: new Date(),
    };

    setPayments(prev => [...prev, payment]);
    return payment;
  }, []);

  // 🔍 Obtener estado de pago
  const getPaymentStatus = useCallback((transactionId: string) => {
    return payments.find(p => p.transactionId === transactionId)?.status ?? null;
  }, [payments]);

  // 💰 Crear venta a crédito
  const createCreditSale = useCallback(async (
    customerId: string, 
    saleId: string, 
    amount: number, 
    days: number
  ) => {
    const dueDate = new Date();
    dueDate.setDate(dueDate.getDate() + days);

    const creditSale: CreditSale = {
      id: `credit_${Date.now()}`,
      customerId,
      saleId,
      amount,
      currency: 'USD',
      dueDate,
      status: 'pending',
      payments: [],
      remainingBalance: amount,
      createdAt: new Date(),
      updatedAt: new Date(),
    };

    setCreditSales(prev => [...prev, creditSale]);
    return creditSale;
  }, []);

  // 💳 Procesar pago de crédito
  const processCreditPayment = useCallback(async (creditSaleId: string, paymentAmount: number) => {
    setCreditSales(prev => prev.map(cs => {
      if (cs.id === creditSaleId) {
        const remainingBalance = Math.max(0, cs.remainingBalance - paymentAmount);
        return {
          ...cs,
          remainingBalance,
          status: remainingBalance === 0 ? 'paid' : 'partial',
          updatedAt: new Date(),
        };
      }
      return cs;
    }));
  }, []);

  // 🔍 Obtener créditos del cliente
  const getCreditSalesForCustomer = useCallback((customerId: string) => {
    return creditSales.filter(cs => cs.customerId === customerId);
  }, [creditSales]);

  // 📱 Crear E-Wallet
  const createEWallet = useCallback(async (customerId: string, initialBalance = 0) => {
    const newWallet: EWallet = {
      id: `ewallet_${Date.now()}`,
      customerId,
      balance: initialBalance,
      currency: 'USD',
      isActive: true,
      createdAt: new Date(),
      updatedAt: new Date(),
    };

    const newEwallets = new Map(ewallets);
    newEwallets.set(customerId, newWallet);
    setEwallets(newEwallets);
    return newWallet;
  }, [ewallets]);

  // ➕ Recargar E-Wallet
  const topUpEWallet = useCallback(async (customerId: string, amount: number) => {
    const newEwallets = new Map(ewallets);
    const wallet = newEwallets.get(customerId);

    if (wallet) {
      newEwallets.set(customerId, {
        ...wallet,
        balance: wallet.balance + amount,
        updatedAt: new Date(),
      });
      setEwallets(newEwallets);
    }
  }, [ewallets]);

  // 💰 Obtener saldo E-Wallet
  const getEWalletBalance = useCallback((customerId: string) => {
    return ewallets.get(customerId)?.balance ?? null;
  }, [ewallets]);

  // 💸 Gastar del E-Wallet
  const chargeEWallet = useCallback(async (customerId: string, amount: number) => {
    const wallet = ewallets.get(customerId);
    if (!wallet || wallet.balance < amount) return false;

    const newEwallets = new Map(ewallets);
    newEwallets.set(customerId, {
      ...wallet,
      balance: wallet.balance - amount,
      updatedAt: new Date(),
    });
    setEwallets(newEwallets);
    return true;
  }, [ewallets]);

  // 📊 Total de pagos
  const getTotalPayments = useCallback(() => {
    return payments
      .filter(p => p.status === 'success')
      .reduce((sum, p) => sum + p.amount, 0);
  }, [payments]);

  // 📊 Pagos por método
  const getPaymentsByMethod = useCallback((method: PaymentMethod) => {
    return payments
      .filter(p => p.method === method && p.status === 'success')
      .reduce((sum, p) => sum + p.amount, 0);
  }, [payments]);

  // 📊 Crédito pendiente
  const getPendingCreditAmount = useCallback(() => {
    return creditSales
      .filter(cs => cs.status !== 'paid')
      .reduce((sum, cs) => sum + cs.remainingBalance, 0);
  }, [creditSales]);

  return {
    payments,
    creditSales,
    ewallets,
    processPayment,
    getPaymentStatus,
    createCreditSale,
    processCreditPayment,
    getCreditSalesForCustomer,
    createEWallet,
    topUpEWallet,
    getEWalletBalance,
    chargeEWallet,
    getTotalPayments,
    getPaymentsByMethod,
    getPendingCreditAmount,
  };
}
