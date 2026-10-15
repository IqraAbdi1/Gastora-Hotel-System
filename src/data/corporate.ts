import type { CorporateAccount } from '../services/corporate/corporateTypes'
import { TODAY } from './sample'

// Sample company accounts. The names are made up. Dates are set relative to today, like the other
// sample data, so the agreements never go out of date while the demo is used.
const day = (offset: number) => {
  const d = new Date(`${TODAY}T00:00:00`)
  d.setDate(d.getDate() + offset)
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`
}
const system = { id: 'system', name: 'Sample data' }
const gm = { id: 'u-gm', name: 'Esther Nambi' }
const fin = { id: 'u-finance', name: 'Brian Ssemakula' }
const desk = { id: 'u-desk', name: 'Rita Auma' }
const at = (offset: number) => `${day(offset)} 10:00`

export function sampleAccounts(): CorporateAccount[] {
  return [
    {
      id: 'CA-001',
      name: 'Lakeside Logistics Ltd',
      tin: '1000123456',
      industry: 'Transport and logistics',
      address: 'Plot 12, Port Bell Road, Kampala',
      phone: '0414 100 100',
      email: 'accounts@lakeside-logistics.example',
      status: 'active',
      paymentTerms: 'net-30',
      creditLimit: 5_000_000,
      outstandingBalance: 1_200_000,
      billing: {
        defaultBillTo: 'company-room',
        invoiceEmail: 'invoices@lakeside-logistics.example',
        poRequired: true,
        instructions: 'Room and breakfast to the company. Bar, laundry and phone to the guest. Quote the LPO number on every invoice.',
      },
      contacts: [
        { id: 'CC-1', name: 'Joan Akello', jobTitle: 'Travel coordinator', phone: '0772 300 101', email: 'joan.akello@lakeside-logistics.example', canBook: true, canApproveCharges: false, active: true },
        { id: 'CC-2', name: 'Samuel Opio', jobTitle: 'Finance manager', phone: '0772 300 102', email: 'samuel.opio@lakeside-logistics.example', canBook: false, canApproveCharges: true, active: true },
      ],
      agreement: {
        reference: 'AGR-LL-01',
        validFrom: day(-200),
        validTo: day(165),
        allowDiscountOnNegotiatedRate: false,
        notes: 'Negotiated rates for Standard and Deluxe. Long-stay discount only on rooms without a negotiated rate.',
        rules: [
          { id: 'PR-1', label: 'Negotiated Standard rate', kind: 'negotiated-rate', value: 120_000, roomTypes: ['Standard'], validFrom: day(-200), validTo: day(165), requiresApproval: false },
          { id: 'PR-2', label: 'Negotiated Deluxe rate', kind: 'negotiated-rate', value: 150_000, roomTypes: ['Deluxe'], validFrom: day(-200), validTo: day(165), requiresApproval: false },
          { id: 'PR-3', label: 'Long stay', kind: 'percent', value: 10, roomTypes: ['Standard', 'Deluxe', 'Suite'], validFrom: day(-200), validTo: day(165), minNights: 5, requiresApproval: false },
        ],
      },
      requiredSteps: ['manager', 'finance'],
      approvals: [
        { step: 'manager', by: gm, at: at(-210) },
        { step: 'finance', by: fin, at: at(-209), note: 'Credit 5,000,000 on 30 days.' },
      ],
      createdAt: at(-212),
      createdBy: system,
      history: [
        { at: at(-212), by: system, action: 'Account requested' },
        { at: at(-210), by: gm, action: 'Manager approved' },
        { at: at(-209), by: fin, action: 'Finance approved', detail: 'Credit limit UGX 5,000,000, invoice 30 days' },
      ],
    },
    {
      id: 'CA-002',
      name: 'Equator Health Partners',
      tin: '1000654321',
      industry: 'Health care',
      address: 'Kololo Hill Drive, Kampala',
      phone: '0414 200 200',
      email: 'admin@equator-health.example',
      status: 'active',
      paymentTerms: 'on-departure',
      creditLimit: 0,
      outstandingBalance: 0,
      billing: {
        defaultBillTo: 'company-all',
        invoiceEmail: 'finance@equator-health.example',
        poRequired: false,
        instructions: 'All charges to the company. The company pays by bank transfer before the guest checks out.',
      },
      contacts: [
        { id: 'CC-3', name: 'Dr Ruth Namubiru', jobTitle: 'Programme director', phone: '0772 400 201', email: 'ruth@equator-health.example', canBook: false, canApproveCharges: true, active: true },
        { id: 'CC-4', name: 'Isaac Mukasa', jobTitle: 'Administrator', phone: '0772 400 202', email: 'isaac@equator-health.example', canBook: true, canApproveCharges: false, active: true },
      ],
      agreement: {
        reference: 'AGR-EH-01',
        validFrom: day(-60),
        validTo: day(300),
        allowDiscountOnNegotiatedRate: false,
        notes: 'Percentage discount on all rooms. Suite discount only with manager approval.',
        rules: [
          { id: 'PR-4', label: 'Company discount', kind: 'percent', value: 15, roomTypes: ['Standard', 'Deluxe'], validFrom: day(-60), validTo: day(300), requiresApproval: false },
          { id: 'PR-5', label: 'Suite discount', kind: 'amount-off', value: 50_000, roomTypes: ['Suite'], validFrom: day(-60), validTo: day(300), requiresApproval: true },
        ],
      },
      requiredSteps: ['manager'],
      approvals: [{ step: 'manager', by: gm, at: at(-61) }],
      createdAt: at(-62),
      createdBy: system,
      history: [
        { at: at(-62), by: system, action: 'Account requested' },
        { at: at(-61), by: gm, action: 'Manager approved', detail: 'No credit: pays at departure' },
      ],
    },
    {
      id: 'CA-003',
      name: 'Pearl Agro Traders',
      tin: '1000777888',
      industry: 'Agriculture',
      address: 'Jinja Road, Mukono',
      phone: '0414 300 300',
      email: 'office@pearl-agro.example',
      status: 'pending',
      paymentTerms: 'prepaid',
      creditLimit: 0,
      requestedCreditLimit: 2_000_000,
      outstandingBalance: 0,
      billing: {
        defaultBillTo: 'company-room',
        invoiceEmail: 'office@pearl-agro.example',
        poRequired: false,
        instructions: 'Asked for invoice terms. Room to the company, extras to the guest.',
      },
      contacts: [
        { id: 'CC-5', name: 'Fred Kiwanuka', jobTitle: 'Operations manager', phone: '0772 500 301', email: 'fred@pearl-agro.example', canBook: true, canApproveCharges: false, active: true },
        { id: 'CC-7', name: 'Harriet Nalwoga', jobTitle: 'Accountant', phone: '0772 500 302', email: 'harriet@pearl-agro.example', canBook: false, canApproveCharges: true, active: true },
      ],
      requiredSteps: ['manager', 'finance'],
      approvals: [],
      createdAt: at(-1),
      createdBy: desk,
      history: [{ at: at(-1), by: desk, action: 'Account requested', detail: 'Asked for UGX 2,000,000 credit on 30 days' }],
    },
    {
      id: 'CA-004',
      name: 'Rwenzori Consulting Group',
      tin: '1000999000',
      industry: 'Consulting',
      address: 'Lumumba Avenue, Kampala',
      phone: '0414 400 400',
      email: 'info@rwenzori-consulting.example',
      status: 'on-hold',
      statusReason: 'Invoices more than 60 days overdue. New company billing paused until paid.',
      paymentTerms: 'net-30',
      creditLimit: 3_000_000,
      outstandingBalance: 3_400_000,
      billing: {
        defaultBillTo: 'company-room',
        invoiceEmail: 'accounts@rwenzori-consulting.example',
        poRequired: true,
        instructions: 'Room only to the company.',
      },
      contacts: [
        { id: 'CC-6', name: 'Agnes Tumusiime', jobTitle: 'Office manager', phone: '0772 600 401', email: 'agnes@rwenzori-consulting.example', canBook: true, canApproveCharges: false, active: true },
        { id: 'CC-8', name: 'Moses Byamugisha', jobTitle: 'Managing partner', phone: '0772 600 402', email: 'moses@rwenzori-consulting.example', canBook: false, canApproveCharges: true, active: true },
      ],
      requiredSteps: ['manager', 'finance'],
      approvals: [
        { step: 'manager', by: gm, at: at(-400) },
        { step: 'finance', by: fin, at: at(-399) },
      ],
      createdAt: at(-401),
      createdBy: system,
      history: [
        { at: at(-401), by: system, action: 'Account requested' },
        { at: at(-399), by: fin, action: 'Finance approved', detail: 'Credit limit UGX 3,000,000, invoice 30 days' },
        { at: at(-5), by: fin, action: 'Put on hold', detail: 'Invoices more than 60 days overdue' },
      ],
    },
  ]
}
