export const PROFILE_TABS = {
  title: "Profile",
  description: "Manage your personal information and preferences",
  tabValues: [
    { value: "profile", label: "Profile" },
    { value: "reviews", label: "Reviews" },
    { value: "verification", label: "Verification" },
    { value: "preferences", label: "Preferences" },
    { value: "security", label: "Security" },
    { value: "billing", label: "Billing" },
  ],
  editButton: {
    label: (editMode: boolean) => (editMode ? "Cancel" : "Edit Profile"),
  },
};

export const PROFILE_OVERVIEW = {
  profileCard: {
    title: "Profile Picture",
    description: "Your public profile image",
    profileImage: "Change profile picture",
    verifiedBadge: "Verified",
    memberSince: "Member since May 2022",
    stats: {
      borrowed: {
        label: "Listings Borrowed",
        count: 32,
      },
      shared: {
        label: "Listings Shared",
        count: 18,
      },
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
