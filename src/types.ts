export type UserRole = 'Admin' | 'Member' | 'Viewer';

export interface UserProfile {
  uid: string;
  email: string;
  username: string;
  full_name?: string;
  initials?: string;
  role: UserRole;
  workspace_roles?: Record<string, UserRole>;
  profileCompleted?: boolean;
  workspaceIds?: string[];
  defaultWorkspaceId?: string;
  blocked?: boolean;
  createdAt?: string;
  dataVisibilityScope?: 'ALL_DATA' | 'OWN_DATA_ONLY';
  dataVisibilityTier?: 'ADVANCED' | 'BASIC';
  allowSalespersonSelection?: boolean;
}

export interface WorkspaceMember {
  uid: string;
  email: string;
  name?: string;
  full_name?: string;
  role?: string;
  joined_at?: string;
}

export interface Workspace {
  id: string;
  name: string;
  description?: string;
  created_by: string;
  createdAt: string;
  modules: {
    enquiriesEnabled: boolean;
    callLogEnabled: boolean;
  };
  geography_options?: string[];
  members?: WorkspaceMember[];
}

export type LegalSuffix = 'None / To Be Added Later' | 'LLC' | 'FZE' | 'FZC' | 'Co. LLC' | 'Ltd' | 'W.L.L.' | 'Est.' | 'None / Other';

export type PhoneCategory = 'Mobile' | 'Telephone' | 'Direct' | 'WhatsApp' | 'Work' | 'Fax' | 'Other';

export interface LabeledPhone {
  number: string;
  label: PhoneCategory | string;
}

export interface LabeledEmail {
  email: string;
  label?: string;
}

export interface LabeledHandle {
  platform: 'WhatsApp' | 'Telegram' | 'LinkedIn' | 'WeChat' | 'Skype' | 'Signal' | string;
  handle: string;
}

export type CompanyRelationship =
  | 'Prospect'
  | 'Active Customer'
  | 'Former Customer'
  | 'Partner / Reseller'
  | 'Vendor / Supplier'
  | 'Competitor'
  | string;

export type CompanyTemperature = 'Hot' | 'Warm' | 'Cold' | string;

export interface SoftDeleteFields {
  is_deleted?: boolean;
  deleted_at?: string;
  deleted_by_uid?: string;
  deleted_by_name?: string;
  created_by_uid?: string;
  created_by_name?: string;
  last_modified_by_uid?: string;
  last_modified_by_name?: string;
  search_terms?: string[];
}

export interface Company extends SoftDeleteFields {
  id?: string;
  workspace_id?: string;
  canonical_name: string;
  legal_suffix: LegalSuffix;
  display_name: string;
  aliases: string[];
  country: string;
  city: string;
  general_phone?: string;
  general_email?: string;
  phones?: LabeledPhone[];
  emails?: LabeledEmail[];
  relationship?: CompanyRelationship;
  temperature?: CompanyTemperature;
  notes?: string;
  is_dnc?: boolean;
  dnc_reason?: string;
  search_terms?: string[];
  createdAt?: string;
  updatedAt?: string;
}

export interface Contact extends SoftDeleteFields {
  id?: string;
  workspace_id?: string;
  company_id: string;
  full_name: string;
  designation?: string;
  mobile?: string;
  landline?: string;
  email?: string;
  phones?: LabeledPhone[];
  emails?: LabeledEmail[];
  handles?: LabeledHandle[];
  is_primary?: boolean;
  is_dnc?: boolean;
  dnc_reason?: string;
  createdAt?: string;
  updatedAt?: string;
}

export function getContactPhones(contact?: Partial<Contact> | null): LabeledPhone[] {
  if (!contact) return [];
  if (contact.phones && contact.phones.length > 0) {
    return contact.phones.filter((p) => p.number && p.number.trim() !== '');
  }
  const result: LabeledPhone[] = [];
  if (contact.mobile) result.push({ number: contact.mobile, label: 'Mobile' });
  if (contact.landline) result.push({ number: contact.landline, label: 'Telephone' });
  return result;
}

export function getContactEmails(contact?: Partial<Contact> | null): LabeledEmail[] {
  if (!contact) return [];
  if (contact.emails && contact.emails.length > 0) {
    return contact.emails.filter((e) => e.email && e.email.trim() !== '');
  }
  if (contact.email) return [{ email: contact.email, label: 'Primary' }];
  return [];
}

export function getContactHandles(contact?: Partial<Contact> | null): LabeledHandle[] {
  if (!contact) return [];
  if (contact.handles && contact.handles.length > 0) {
    return contact.handles.filter((h) => h.handle && h.handle.trim() !== '');
  }
  return [];
}

export function getCompanyPhones(company?: Partial<Company> | null): LabeledPhone[] {
  if (!company) return [];
  if (company.phones && company.phones.length > 0) {
    return company.phones.filter((p) => p.number && p.number.trim() !== '');
  }
  if (company.general_phone) return [{ number: company.general_phone, label: 'Telephone' }];
  return [];
}

export function getCompanyEmails(company?: Partial<Company> | null): LabeledEmail[] {
  if (!company) return [];
  if (company.emails && company.emails.length > 0) {
    return company.emails.filter((e) => e.email && e.email.trim() !== '');
  }
  if (company.general_email) return [{ email: company.general_email, label: 'General' }];
  return [];
}

export type ItemType = 'product' | 'charge' | 'discount';

export type ProductType = string;

export type UnitType = string;

export interface ProductAttribute {
  key: string;
  value: string;
}

export interface LineItem {
  id?: string;
  item_type?: ItemType;
  charge_type?: string;
  product_type: ProductType;
  description: string;
  quantity: number;
  unit: UnitType;
  unit_price: number;
  total_price: number;
  lead_time_note?: string;
  attributes?: ProductAttribute[];
  option?: string; // e.g. Option A, Option B, etc.
}

export interface Attachment {
  name: string;
  size: number;
  type: string;
  url: string;
  uploadedAt: string;
}

export type EnquirySource = string;

export type EnquiryStatus =
  | 'Active'
  | 'Order Received'
  | 'Lost'
  | 'Dead'
  | 'Hold'
  | 'Delayed'
  | 'Cancelled PO';

export interface Enquiry extends SoftDeleteFields {
  id?: string;
  workspace_id?: string;
  sn: number;
  enquiry_date: string;
  sales_person_id?: string;
  sales_person?: string; // initials (e.g. PV, NS) or display name
  company_id: string;
  contact_id?: string;
  country: string;
  project_location: string;
  enquiry_source: EnquirySource;
  status: EnquiryStatus;
  quote_ref_no: string;
  subject?: string; // Optional Subject for the proposal
  customer_reference_code?: string; // Optional Customer Reference Code
  proposal_option?: string; // e.g. Option A, Option B for alternative versions
  projected_order_date?: string;
  next_followup_date?: string;
  value_aed: number;
  currency?: 'AED' | 'USD';
  is_lump_sum?: boolean;
  remarks?: string;
  invoice_po_no?: string;
  payment_status?: string;
  custom_project_details?: ProductAttribute[];
  line_items: LineItem[];
  attachments?: Attachment[];
  concerned_persons?: string[];
  concerned_person?: string;
  createdAt?: string;
  updatedAt?: string;
  createdByUid?: string;
  createdByUsername?: string;
  updatedByUid?: string;
  updatedByUsername?: string;
  parent_id?: string | null; // Real link to original enquiry for revision tracking
  revision_number?: number; // Revision number: 0 for original, 1 for Rev-1, 2 for Rev-2, etc.
}

export interface DropdownOption {
  id: string;
  name: string;
  color?: string;
}

export interface Invite {
  id?: string;
  code: string;
  role: UserRole;
  workspaceId?: string;
  workspace_id?: string;
  workspaceName?: string;
  used: boolean;
  is_used?: boolean;
  claimed_by_uid?: string;
  claimed_by_email?: string;
  claimed_at?: string;
  usedBy?: string;
  usedAt?: string;
  usedByList?: { uid: string; email: string; name?: string; at: string }[];
  createdBy: string;
  createdByEmail?: string;
  createdAt: string;
  notes?: string;
}

export interface AuditDiff {
  field: string;
  old_value: any;
  new_value: any;
}

export interface AuditLog {
  id?: string;
  document_id: string;
  entity_type: 'company' | 'contact' | 'enquiry' | 'call_log' | 'product' | 'salesperson' | 'workspace' | 'user';
  entity_title?: string;
  action: 'create' | 'update' | 'delete';
  changed_by_uid: string;
  changed_by_name: string;
  changed_by_email?: string;
  timestamp: string;
  before: any;
  after: any;
  changes?: AuditDiff[];
  details?: string;
}

export interface Salesperson {
  id?: string;
  workspace_id?: string;
  initials?: string;
  full_name: string;
  role: string;
  email?: string;
  phone?: string;
  linked_user_id?: string;
}

export interface Product extends SoftDeleteFields {
  id?: string;
  workspace_id?: string;
  name?: string;
  product_type: ProductType;
  description: string;
  unit: UnitType;
  unit_price?: number;
  sku?: string;
  createdAt?: string;
  attributes?: ProductAttribute[];
}

export const getInitials = (name?: string | null): string => {
  if (!name || typeof name !== 'string') return '??';
  const trimmed = name.trim();
  if (!trimmed) return '??';
  const parts = trimmed.split(/\s+/);
  if (parts.length >= 2 && parts[0][0] && parts[parts.length - 1][0]) {
    return (parts[0][0] + parts[parts.length - 1][0]).toUpperCase();
  }
  return (trimmed || '??').substring(0, Math.min(2, trimmed.length)).toUpperCase();
};

export function normalizeAttributes(attributes: any): ProductAttribute[] {
  if (!attributes) return [];
  if (Array.isArray(attributes)) {
    return attributes.map(a => ({
      key: (a && typeof a === 'object' && a.key !== undefined && a.key !== null) ? String(a.key) : '',
      value: (a && typeof a === 'object' && a.value !== undefined && a.value !== null) ? String(a.value) : ''
    })).filter(a => a.key !== '' || a.value !== '');
  }
  if (typeof attributes === 'object') {
    return Object.entries(attributes).map(([key, value]) => ({
      key,
      value: String(value || '')
    }));
  }
  return [];
}

export type CallStatus = 'Scheduled' | 'Completed' | 'Cancelled' | 'Follow-Up Required' | 'No Answer / Voicemail' | string;

export type CallOutcome =
  | 'Reached - Interested'
  | 'Reached - Not Interested'
  | 'No Answer / Voicemail'
  | 'Follow-Up Required'
  | 'Wrong Number'
  | 'DNC Request'
  | 'Closed - Deal Made'
  | 'General Inquiry / Support'
  | string;

export interface CallLogEntry extends SoftDeleteFields {
  id?: string;
  workspace_id: string;
  date: string; // ISO or YYYY-MM-DD
  status: CallStatus;
  outcome?: CallOutcome | string;
  requirement_notes?: string;
  next_followup_date?: string;
  company_id?: string;
  company_name?: string;
  contact_id?: string;
  contact_name?: string;
  contact_phone?: string;
  enquiry_id?: string; // Optional link to Enquiry
  enquiry_quote_ref?: string;
  logged_by: string;
  sales_person_id?: string;
  sales_person?: string;
  handled_by_salesperson_id?: string;
  handled_by_team_member_name?: string;
  interaction_type?: 'call' | 'email' | 'message';
  email_subject?: string;
  email_address?: string;
  message_platform?: string;
  geography?: string; // Configurable geography/region field
  purpose?: string; // Call purpose / reason (e.g. Prospecting, Quote Follow-Up, Technical Support, Payment Collection)
  concerned_persons?: string[];
  concerned_person?: string;
  createdAt?: string;
  updatedAt?: string;
}

export const CATEGORY_SUGGESTED_ATTRIBUTES: Record<string, string[]> = {
  'FRP Tanks': ['Brand / Make', 'Diameter', 'Height', 'Volume', 'Design Pressure'],
  'FRP Vessels': ['Brand / Make', 'Model', 'Top/Bottom Opening', 'Volume'],
  'Pressure Vessels': ['Brand / Make', 'Shell Material', 'Design Temp', 'Volume'],
  'RO Membranes': ['Brand / Make', 'Membrane Type', 'Active Area', 'Flow Rate', 'Salt Rejection'],
  'RO Housing': ['Brand / Make', 'Ports', 'Element Capacity', 'Max Pressure'],
  'Cartridge Filters': ['Brand / Make', 'Micron Rating', 'Length', 'Material', 'Core Material'],
  'Dosing Pumps': ['Brand / Make', 'Flow Rate', 'Pressure', 'Voltage', 'Control Type'],
  'MBBR Media': ['Brand / Make', 'Specific Surface Area', 'Void Ratio', 'Density', 'Material'],
  'Filter Media': ['Brand / Make', 'Media Type', 'Effective Size', 'Uniformity Coefficient', 'Specific Gravity'],
  'Tube Settler Media': ['Brand / Make', 'Chamber Length', 'Slope Angle', 'Material'],
  'Chemicals': ['Brand / Make', 'Form', 'Concentration', 'Packaging Type'],
  'Valves': ['Brand / Make', 'Size', 'Body Material', 'Actuator Type', 'Connection Type'],
  'Frames/Fabrication': ['Brand / Make', 'Material Grade', 'Surface Finish', 'Dimensions'],
  'Various': ['Brand / Make', 'Model/Specification'],
  'Other': ['Brand / Make', 'Specification']
};
