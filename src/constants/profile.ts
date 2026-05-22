export const PROFILE_TABS = {
  title: "Profile",
  description: "Manage your personal information and preferences",
  tabValues: [
    { value: "profile", label: "Profile" },
    { value: "reviews", label: "Reviews" },
    { value: "preferences", label: "Preferences" },
    // TODO: Add Verification, Preferences, Security
    // { value: "verification", label: "Verification" },
    // { value: "security", label: "Security" },
  ],
  editButton: {
    label: (editMode: boolean) => (editMode ? "Cancel" : "Edit Profile"),
  },
};

export const PROFILE_PAGE_HEADERS = {
  profile: {
    title: "Profile",
    description: "Manage your personal information",
  },
  reviews: {
    title: "Reviews",
    description: "View your reviews and ratings from the community",
  },
  security: {
    title: "Security",
    description: "Manage your password and security settings",
  },
  preferences: {
    title: "Preferences",
    description: "Customize your notification and app preferences",
  },
  verification: {
    title: "Verification",
    description: "Verify your identity and build trust in the community",
  },
  billing: {
    title: "Billing",
    description: "Manage your payment methods and billing information",
  },
} as const;

export const US_STATES = [
  { value: "AL", label: "Alabama" },
  { value: "AK", label: "Alaska" },
  { value: "AZ", label: "Arizona" },
  { value: "AR", label: "Arkansas" },
  { value: "CA", label: "California" },
  { value: "CO", label: "Colorado" },
  { value: "CT", label: "Connecticut" },
  { value: "DE", label: "Delaware" },
  { value: "DC", label: "District of Columbia" },
  { value: "FL", label: "Florida" },
  { value: "GA", label: "Georgia" },
  { value: "HI", label: "Hawaii" },
  { value: "ID", label: "Idaho" },
  { value: "IL", label: "Illinois" },
  { value: "IN", label: "Indiana" },
  { value: "IA", label: "Iowa" },
  { value: "KS", label: "Kansas" },
  { value: "KY", label: "Kentucky" },
  { value: "LA", label: "Louisiana" },
  { value: "ME", label: "Maine" },
  { value: "MD", label: "Maryland" },
  { value: "MA", label: "Massachusetts" },
  { value: "MI", label: "Michigan" },
  { value: "MN", label: "Minnesota" },
  { value: "MS", label: "Mississippi" },
  { value: "MO", label: "Missouri" },
  { value: "MT", label: "Montana" },
  { value: "NE", label: "Nebraska" },
  { value: "NV", label: "Nevada" },
  { value: "NH", label: "New Hampshire" },
  { value: "NJ", label: "New Jersey" },
  { value: "NM", label: "New Mexico" },
  { value: "NY", label: "New York" },
  { value: "NC", label: "North Carolina" },
  { value: "ND", label: "North Dakota" },
  { value: "OH", label: "Ohio" },
  { value: "OK", label: "Oklahoma" },
  { value: "OR", label: "Oregon" },
  { value: "PA", label: "Pennsylvania" },
  { value: "RI", label: "Rhode Island" },
  { value: "SC", label: "South Carolina" },
  { value: "SD", label: "South Dakota" },
  { value: "TN", label: "Tennessee" },
  { value: "TX", label: "Texas" },
  { value: "UT", label: "Utah" },
  { value: "VT", label: "Vermont" },
  { value: "VA", label: "Virginia" },
  { value: "WA", label: "Washington" },
  { value: "WV", label: "West Virginia" },
  { value: "WI", label: "Wisconsin" },
  { value: "WY", label: "Wyoming" },
] as const;

export const PROFILE_OVERVIEW = {
  profileCard: {
    title: "Profile Picture",
    description: "Your public profile image",
    stats: {
      borrowed: { label: "Listings Borrowed" },
      shared: { label: "Listings Shared" },
    },
  },
  formCard: {
    title: "Personal Information",
    description: "Update your personal details",
    fields: {
      firstName: "First Name",
      lastName: "Last Name",
      email: "Email",
      phone: "Phone",
      street: "Street",
      city: "City",
      state: "State",
      zipCode: "ZIP Code",
      bio: "Bio",
    },
    saveChanges: "Save Changes",
    saving: "Saving...",
  },
};
