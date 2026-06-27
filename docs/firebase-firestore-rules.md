# Firebase Firestore Rules

Paste these rules in Firebase Console > Firestore Database > Rules, or deploy them with Firebase CLI if this project is configured:

```bash
firebase deploy --only firestore:rules
```

```js
rules_version = '2';

service cloud.firestore {
  match /databases/{database}/documents {
    function isAdmin() {
      return request.auth != null
        && request.auth.token.email == "anubhaparashar1025@gmail.com";
    }

    function isNonEmptyString(value, maxLength) {
      return value is string && value.size() > 0 && value.size() <= maxLength;
    }

    function validPendingComment(postSlug) {
      return request.resource.data.keys().hasOnly([
        'id',
        'commentId',
        'postSlug',
        'status',
        'approved',
        'name',
        'authorName',
        'authorAvatarUrl',
        'text',
        'message',
        'body',
        'source',
        'sourceCommentId',
        'importedAt',
        'createdAt',
        'updatedAt'
      ])
      && request.resource.data.postSlug == postSlug
      && request.resource.data.status == 'pending'
      && request.resource.data.approved == false
      && isNonEmptyString(request.resource.data.name, 80)
      && isNonEmptyString(request.resource.data.authorName, 80)
      && isNonEmptyString(request.resource.data.text, 1000)
      && isNonEmptyString(request.resource.data.message, 1000)
      && isNonEmptyString(request.resource.data.body, 1000)
      && request.resource.data.source == 'firebase';
    }

    function validPendingPostMetadata(postSlug) {
      return request.resource.data.keys().hasOnly(['postSlug', 'updatedAt', 'hasPendingComments'])
        && request.resource.data.postSlug == postSlug
        && request.resource.data.hasPendingComments == true;
    }

    match /postStats/{postId} {
      allow read: if true;

      allow create: if request.resource.data.keys().hasOnly([
        'title',
        'path',
        'slug',
        'views',
        'likes',
        'comments',
        'importedLegacyViews',
        'importedGiscusLikes',
        'importedGiscusComments',
        'createdAt',
        'updatedAt'
      ]);

      allow update: if isAdmin()
        || request.resource.data.diff(resource.data).changedKeys()
          .hasOnly(['views', 'likes', 'comments', 'importedLegacyViews', 'updatedAt']);

      allow delete: if false;
    }

    match /postReactions/{postId} {
      allow read: if true;

      allow create: if request.resource.data.keys().hasOnly([
        'thumbsUp',
        'heart',
        'rocket',
        'hooray',
        'laugh',
        'confused',
        'eyes',
        'importedGiscusReactions',
        'createdAt',
        'updatedAt'
      ]);

      allow update: if request.resource.data.diff(resource.data).changedKeys()
        .hasOnly(['thumbsUp', 'heart', 'rocket', 'hooray', 'laugh', 'confused', 'eyes', 'updatedAt']);

      allow delete: if false;
    }

    match /pendingCommentQueue/{queueId} {
      allow create: if request.resource.data.status == 'pending'
        && request.resource.data.postSlug is string;
      allow read, update, delete: if isAdmin();
    }

    match /pendingComments/{postSlug} {
      allow read, delete: if isAdmin();
      allow create, update: if isAdmin() || validPendingPostMetadata(postSlug);

      match /comments/{commentId} {
        allow create: if !exists(/databases/$(database)/documents/pendingComments/$(postSlug)/comments/$(commentId))
          && validPendingComment(postSlug);
        allow read, update, delete: if isAdmin();
      }
    }

    match /postComments/{postSlug} {
      allow read, create, update, delete: if false;

      match /comments/{commentId} {
        allow read: if true;
        allow create, update, delete: if isAdmin();
      }
    }

    match /projectPosts/{postId} {
      allow read: if true;

      match /comments/{commentId} {
        allow read: if true;
      }

      match /reactionImports/{reactionId} {
        allow read: if true;
      }
    }

    match /giscusArchive/{discussionId} {
      allow read, write: if false;
    }
  }
}
```

## Moderated comment flow

Public comments are submitted to:

```txt
pendingComments/{postSlug}/comments/{commentId}
```

The admin page at `/projects/admin-comments.html` lets the authorized Google account approve or reject them.

Approved comments are copied to the public path:

```txt
postComments/{postSlug}/comments/{commentId}
```

Rejected comments are deleted only from `pendingComments`. Existing approved comments under `postComments` are not deleted or hidden.

If Firebase CLI is not configured, go to Firebase Console -> Firestore Database -> Rules, paste the rules above, and click Publish.