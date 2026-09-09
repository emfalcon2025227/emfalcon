# Project Rules & Conventions

## Default Searchable Combobox Standard
- **Always use `SearchableSelect`** (`src/components/common/SearchableSelect.tsx`) for all selection dropdowns and comboboxes in the system.
- **Partial Text Search (`matchAnyArabicSearch`)**: All combobox search filters must match any partial substring across titles, sub-labels, badges, codes, or extra metadata using Arabic-normalized string matching.
- **Contextual Sub-Labels & Extra Information**:
  - **Properties**: Always display the Owner's name as a contextual sub-label (`المالك: ...`).
  - **Rental Units**: Always display the active Tenant's name (`المستأجر: ...`) or vacancy status (`شاغرة`).
  - **Users / Legal Counsel / Technicians**: Display role, company, phone number, or specialization.
