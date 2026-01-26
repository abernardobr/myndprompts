# Move Storage Feature - Manual Test Plan

## Overview

This document outlines the manual testing procedures for the Move Storage feature in MyndPrompts. The feature allows users to relocate their storage directory to a different location on their system.

## Prerequisites

Before testing, ensure:

- MyndPrompts is installed and running
- You have some existing data (prompts, snippets, personas, templates, projects)
- You have write access to the destination location
- Sufficient disk space at the destination

## Test Scenarios

### 1. Basic Migration Flow

#### TC-1.1: Successful Migration to Empty Directory

**Steps:**

1. Open Settings → Storage tab
2. Click "Change Location" button
3. Select an empty directory with sufficient space
4. Observe the validation phase
5. Review the migration plan showing files/folders to copy
6. Click "Start Migration"
7. Wait for migration to complete
8. Verify success message appears

**Expected Results:**

- Validation shows green checkmarks for all checks
- Progress bar shows accurate progress
- All files are copied to new location
- Application continues to function normally
- Settings show new storage location

#### TC-1.2: Migration with Verification

**Steps:**

1. Complete TC-1.1
2. Check the verification results displayed
3. Compare file counts between source and destination
4. Open a few prompts/snippets to verify content

**Expected Results:**

- Verification shows 100% success
- All files are accessible
- Content is identical to original

### 2. Validation Tests

#### TC-2.1: Insufficient Disk Space

**Steps:**

1. Try to migrate to a location with less space than required
2. Observe validation results

**Expected Results:**

- Validation fails with "Insufficient disk space" message
- Migration cannot proceed
- Required vs available space is shown

#### TC-2.2: No Write Permission

**Steps:**

1. Select a directory without write permissions (e.g., system directory)
2. Observe validation results

**Expected Results:**

- Validation fails with permission error
- Clear error message is displayed
- Migration cannot proceed

#### TC-2.3: Same Location Selected

**Steps:**

1. Try to select the current storage location as destination
2. Observe validation results

**Expected Results:**

- Validation fails with appropriate message
- User is informed they need to select a different location

#### TC-2.4: Nested Directory (Child of Current)

**Steps:**

1. Try to select a subdirectory within current storage
2. Observe validation results

**Expected Results:**

- Validation fails with nested path error
- Migration cannot proceed

#### TC-2.5: Parent Directory of Current Storage

**Steps:**

1. Try to select the parent directory of current storage
2. Observe validation results

**Expected Results:**

- Validation fails with nested path error
- Migration cannot proceed

### 3. Progress and Cancellation

#### TC-3.1: Progress Updates During Large Migration

**Steps:**

1. Create or have a storage with many files (100+)
2. Start a migration
3. Observe progress updates

**Expected Results:**

- Progress bar updates smoothly
- Current file name is displayed
- Percentage is accurate
- ETA (if shown) is reasonable

#### TC-3.2: Cancel Migration

**Steps:**

1. Start a migration with many files
2. Click "Cancel" during the copy phase
3. Observe behavior

**Expected Results:**

- Migration stops promptly
- Partial files at destination are cleaned up
- Original storage remains intact
- User can retry or choose different location

### 4. Error Handling and Recovery

#### TC-4.1: Rollback After Error

**Steps:**

1. Start a migration
2. If an error occurs (or simulate by removing write permission mid-migration)
3. Click "Rollback" button if offered

**Expected Results:**

- Rollback completes successfully
- Destination is cleaned up
- Original storage remains intact
- User can retry migration

#### TC-4.2: Resume Incomplete Migration

**Steps:**

1. Start a migration
2. Close the application unexpectedly (or crash simulation)
3. Reopen the application
4. Check if resume option is offered

**Expected Results:**

- Application detects incomplete migration
- Offers to resume or rollback
- Resume completes the migration correctly
- Files already copied are not recopied

#### TC-4.3: File in Use Error

**Steps:**

1. Open a file from storage in external application
2. Start migration
3. Observe handling of locked file

**Expected Results:**

- Error is reported with specific file name
- Migration can be retried or rolled back
- Helpful message about closing applications

### 5. Cleanup Options

#### TC-5.1: Delete Old Storage After Migration

**Steps:**

1. Complete a successful migration
2. Choose "Delete old storage" option
3. Verify old location

**Expected Results:**

- Old storage directory is removed
- Only new location contains data
- Application continues to function

#### TC-5.2: Keep Old Storage After Migration

**Steps:**

1. Complete a successful migration
2. Choose "Keep old storage" option
3. Verify both locations

**Expected Results:**

- Old storage directory still exists
- New location is now active
- Application uses new location

### 6. Edge Cases

#### TC-6.1: Empty Storage Migration

**Steps:**

1. With empty storage (new installation), change location
2. Complete migration

**Expected Results:**

- Migration completes quickly
- Empty directory structure is created
- Application functions normally

#### TC-6.2: Large Files

**Steps:**

1. Create or have storage with large files (100MB+)
2. Perform migration
3. Verify large files

**Expected Results:**

- Large files are copied correctly
- Progress reflects large file copy time
- Verification succeeds

#### TC-6.3: Special Characters in Filenames

**Steps:**

1. Create files with special characters (spaces, unicode, etc.)
2. Perform migration
3. Verify files with special names

**Expected Results:**

- All files are copied correctly
- Filenames are preserved exactly
- Files are accessible after migration

#### TC-6.4: Deep Directory Nesting

**Steps:**

1. Create deeply nested directory structure (10+ levels)
2. Perform migration
3. Verify nested structure

**Expected Results:**

- All nested directories are copied
- File paths are preserved
- Content is accessible

#### TC-6.5: Symlinks in Storage

**Steps:**

1. If symlinks exist in storage, perform migration
2. Verify symlink handling

**Expected Results:**

- Symlinks are handled appropriately (copied as files or preserved)
- No errors from symlink processing

### 7. Cross-Platform Tests (if applicable)

#### TC-7.1: External Drive Migration

**Steps:**

1. Migrate storage to external USB drive
2. Verify functionality
3. Remove and reconnect drive

**Expected Results:**

- Migration to external drive succeeds
- Files are accessible when drive connected
- Graceful handling when drive disconnected

#### TC-7.2: Network Drive Migration

**Steps:**

1. Migrate storage to network drive (if supported)
2. Verify functionality
3. Test with intermittent connection

**Expected Results:**

- Migration succeeds
- Network latency doesn't cause failures
- Proper error handling for disconnection

### 8. UI/UX Tests

#### TC-8.1: Dialog Responsiveness

**Steps:**

1. Open Move Storage dialog
2. Resize application window
3. Test on different screen sizes

**Expected Results:**

- Dialog is responsive
- All elements are visible
- Buttons are accessible

#### TC-8.2: Localization

**Steps:**

1. Change application language
2. Open Move Storage dialog
3. Verify all text is translated

**Expected Results:**

- All labels and messages are translated
- No missing translations
- Layout accommodates different text lengths

#### TC-8.3: Error Message Clarity

**Steps:**

1. Trigger various error conditions
2. Read error messages

**Expected Results:**

- Messages clearly explain the problem
- Suggested actions are provided
- Technical details available but not overwhelming

## Regression Tests

After any changes to Move Storage feature:

1. **Basic Flow**: Complete TC-1.1 and TC-1.2
2. **Validation**: Complete TC-2.1 through TC-2.3
3. **Error Handling**: Complete TC-4.1
4. **Cleanup**: Complete TC-5.1 or TC-5.2

## Known Limitations

- Migration cannot be performed while files are being actively edited
- Network drives may have performance limitations
- Very large storage directories (100GB+) may take significant time

## Test Environment Checklist

- [ ] Development build tested
- [ ] Production build tested
- [ ] macOS tested
- [ ] Windows tested (if applicable)
- [ ] Linux tested (if applicable)
- [ ] Fresh installation tested
- [ ] Upgrade installation tested

## Sign-off

| Tester | Date | Build Version | Result |
| ------ | ---- | ------------- | ------ |
|        |      |               |        |
|        |      |               |        |

## Notes

- Record any issues found during testing
- Document workarounds if necessary
- Update test plan as feature evolves
