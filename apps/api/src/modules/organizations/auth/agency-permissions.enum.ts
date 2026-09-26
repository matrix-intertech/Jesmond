export enum AgencyPermission {
  // Properties
  PROPERTY_VIEW = 'property.view',
  PROPERTY_VIEW_DETAILS = 'property.view_details',
  PROPERTY_CREATE = 'property.create',
  PROPERTY_EDIT = 'property.edit',
  PROPERTY_DELETE = 'property.delete',
  PROPERTY_MANAGE_APPLICATIONS = 'property.manage_applications',

  // Leads
  LEAD_VIEW = 'lead.view',
  LEAD_CREATE = 'lead.create',
  LEAD_EDIT = 'lead.edit',
  LEAD_DELETE = 'lead.delete',
  LEAD_ASSIGN = 'lead.assign',

  // Enquiries
  ENQUIRY_VIEW = 'enquiry.view',
  ENQUIRY_RESPOND = 'enquiry.respond',
  ENQUIRY_DELETE = 'enquiry.delete',

  // Team
  TEAM_VIEW = 'team.view',
  TEAM_INVITE = 'team.invite',
  TEAM_EDIT = 'team.edit',
  TEAM_REMOVE = 'team.remove',

  // Agency
  AGENCY_VIEW_SETTINGS = 'agency.view_settings',
  AGENCY_MANAGE_SETTINGS = 'agency.manage_settings',
  AGENCY_MANAGE_ROLES = 'agency.manage_roles',

  // Backwards compatibility mappings for older usages if needed:
  // But it's better to just use the new ones in the code.
}
