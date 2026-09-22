# Personal Knowledge Base and Blog Platform

A dual-mode, terminal-native personal knowledge base and blog platform powered by vector search and generative retrieval, with strict public/private access partitioning.

## Language

**Document**:
A primary piece of written content stored as Markdown with frontmatter metadata.
_Avoid_: Post, article, file, note

**Chunk**:
A semantically cohesive section of a Document produced by splitting for vector embedding and similarity search.
_Avoid_: Fragment, segment, paragraph, snippet

**Visibility**:
The privacy classification of a Document and its Chunks, strictly partitioned into `public` (accessible to all visitors) or `private` (accessible only to authenticated root users).
_Avoid_: Permission, scope, access level

**Terminal**:
The primary interactive Web shell interface that accepts text commands and coordinates search, Q&A, and navigation.
_Avoid_: Command line, CLI, console

**Window Card**:
An ASCII-framed visual viewport container (styled after retro terminal windows) used to present Document contents, previews, and metadata in a split pane.
_Avoid_: Modal, popup, card, panel

**Role**:
The authorization identity of the active session, either `guest` (unauthenticated visitor) or `root` (authenticated owner).
_Avoid_: User, account, profile

**Virtual Shell**:
A client-side sandboxed command dispatcher and in-memory Virtual File System (VFS) in the Terminal that provides Linux builtins (`cd`, `pwd`, `whoami`, `uname`, `history`, `echo`, `uptime`, `date`, `man`) and modern CLI tools (`neofetch`, `bat`, `glow`, `tldr`, `tree`) without server execution.
_Avoid_: Remote shell, SSH, backend terminal emulator
