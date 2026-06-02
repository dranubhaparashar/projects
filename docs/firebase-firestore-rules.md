# Firebase Firestore Rules

Paste these rules in Firebase Console > Firestore Database > Rules.

```js
rules_version = '2';

service cloud.firestore {
  match /databases/{database}/documents {

    match /projectPosts/{postId} {
      allow read: if true;

      allow create: if request.resource.data.keys().hasOnly([
        'title',
        'path',
        'slug',
        'baseViews',
        'views',
        'baseLikes',
        'likes',
        'baseCommentsCount',
        'commentsCount',
        'createdAt',
        'updatedAt'
      ]);

      allow update: if request.resource.data.diff(resource.data).changedKeys()
        .hasOnly(['views', 'likes', 'commentsCount', 'updatedAt']);

      allow delete: if false;

      match /comments/{commentId} {
        allow read: if true;

        allow create: if request.resource.data.keys().hasOnly([
          'name',
          'message',
          'createdAt'
        ])
        && request.resource.data.name is string
        && request.resource.data.message is string
        && request.resource.data.name.size() <= 80
        && request.resource.data.message.size() <= 1000;

        allow update, delete: if false;
      }
    }
  }
}
```

These rules allow public reads, merge-safe frontend document creation, and frontend updates only for `views`, `likes`, `commentsCount`, and `updatedAt`. Historical counters such as `baseViews`, `baseLikes`, and `baseCommentsCount` should be written only by trusted migration scripts using the Firebase Admin SDK.
