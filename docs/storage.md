# Vault storage

## Projects

A project is a name and an existing folder. .sct does not read, move, or change the contents of the folder.
.sct saves projects in `projects.json` in the Electron `userData` folder. On macOS, this folder is usually `~/Library/Application Support/.sct`.

- Each project name must be unique. The comparison ignores letter case.
- Each folder can belong to one project only. .sct also rejects a symbolic link to a saved folder.
- To delete a project, type its name. The deletion also deletes the vault folder of the project.

## Secrets

A secret name contains letters, digits, and underscores. It cannot start with a digit. Each name is unique in its project.
A value can be empty. A value cannot contain a null character, because process environments cannot contain null characters.
The renderer clears the value field after each request. It never receives a stored value.

A secret that arrives through the relay keeps its grant. See [relay delivery](relay.md#relay-delivery).
After the access deadline, .sct refuses every read of that secret, including `sct run`.
.sct does not share an injection-only secret again through AirDrop or the relay.
.sct deletes an expired received secret at each unlock, each minute, and after the Mac resumes.
It deletes the encrypted vault entry.
The app saves cleanup results in an encrypted file in its application data folder.
If the Mac is off or asleep, cleanup starts when the app starts or the Mac resumes.

## Files and keys

When .sct starts, it makes the vault folder `~/.sct`. Each project has one file: `.sct/[project-name]/secrets.sct`.
The folder also has `vault.json`. That file holds the key settings, the salt, and the verifier. It holds no secret.

- One master key opens the whole vault. A passphrase derives it with `scrypt`.
- Each value has its own data key. The master key wraps that data key. This is envelope encryption.
- `secrets.sct` holds encrypted names and encrypted values. Its magic value is `SCT2`.
- The OS secret store is optional. "Remember this device" keeps a copy of the master key there.

The passphrase is not stored. A wrong passphrase fails the verifier, and .sct clears the derived key.

## Unlock

The app asks for the passphrase at each start, unless "Remember this device" stored the key.
The paths `sct run`, `sct _env`, and `sct mcp` open one unlock window when the vault is locked.
The master key stays in main-process memory. It never reaches the renderer.

If the system has no secret service, "Remember this device" is off.
The passphrase still opens the vault.

## The clean break

The new build reads no `SCT1` file and no old transfer file.
Add your secrets again after the first unlock.
The old Keychain items stay on the Mac until you delete them. The new build does not read them.

## Move the vault

To move the vault folder, select **Storage**, then select **Change location…**.
.sct saves the new location in `settings.json` in the `userData` folder.
`vault.json` moves with the folder, so the same passphrase opens the vault in its new location.
Keep the vault outside source folders.

If a project deletion fails, .sct keeps the project and its remaining entries for another attempt.

## Internal reads

Main-process code reads one value with `Vault.withSecret({ projectId, id }, use)`.
No preload operation and no IPC handler gives access to this read.

- The method decrypts only the selected value.
- After the callback, the method clears the plaintext Buffer and its copy of the value key. It also does this when the callback fails.
- The callback can encrypt the Buffer and return ciphertext. The callback must not keep or return plaintext.
- Clearing a Buffer cannot clear copies that the callback makes, for example strings.
- Do not call another vault operation from the callback. All vault operations use the same serial queue.
