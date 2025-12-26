-- Create Users table
CREATE TABLE Users (
    userId UNIQUEIDENTIFIER PRIMARY KEY DEFAULT NEWID(),
    email NVARCHAR(255) NOT NULL UNIQUE,
    passwordHash NVARCHAR(255) NOT NULL,
    firstName NVARCHAR(100),
    lastName NVARCHAR(100),
    isAdmin BIT DEFAULT 0,
    createdAt DATETIME2 DEFAULT GETUTCDATE(),
    lastLoginAt DATETIME2
);

-- Create Courses table
CREATE TABLE Courses (
    courseId UNIQUEIDENTIFIER PRIMARY KEY DEFAULT NEWID(),
    title NVARCHAR(255) NOT NULL,
    description NVARCHAR(MAX),
    thumbnailUrl NVARCHAR(500),
    launchFile NVARCHAR(255) NOT NULL DEFAULT 'index.html',
    activityId NVARCHAR(500) NOT NULL, -- xAPI activity IRI
    blobPath NVARCHAR(500) NOT NULL, -- e.g., "courses/course-123/xapi/"
    createdAt DATETIME2 DEFAULT GETUTCDATE(),
    updatedAt DATETIME2 DEFAULT GETUTCDATE()
);

-- Create Enrollments table
CREATE TABLE Enrollments (
    enrollmentId UNIQUEIDENTIFIER PRIMARY KEY DEFAULT NEWID(),
    userId UNIQUEIDENTIFIER NOT NULL,
    courseId UNIQUEIDENTIFIER NOT NULL,
    enrolledAt DATETIME2 DEFAULT GETUTCDATE(),
    status NVARCHAR(50) DEFAULT 'enrolled', -- enrolled, completed, etc.
    FOREIGN KEY (userId) REFERENCES Users(userId) ON DELETE CASCADE,
    FOREIGN KEY (courseId) REFERENCES Courses(courseId) ON DELETE CASCADE,
    UNIQUE(userId, courseId)
);

-- Create Attempts table
CREATE TABLE Attempts (
    attemptId UNIQUEIDENTIFIER PRIMARY KEY DEFAULT NEWID(),
    userId UNIQUEIDENTIFIER NOT NULL,
    courseId UNIQUEIDENTIFIER NOT NULL,
    startedAt DATETIME2 DEFAULT GETUTCDATE(),
    completedAt DATETIME2 NULL,
    lastAccessedAt DATETIME2 DEFAULT GETUTCDATE(),
    registrationId UNIQUEIDENTIFIER NOT NULL, -- xAPI registration UUID
    FOREIGN KEY (userId) REFERENCES Users(userId) ON DELETE CASCADE,
    FOREIGN KEY (courseId) REFERENCES Courses(courseId) ON DELETE CASCADE
);

-- Create indexes for performance
CREATE INDEX IX_Enrollments_UserId ON Enrollments(userId);
CREATE INDEX IX_Enrollments_CourseId ON Enrollments(courseId);
CREATE INDEX IX_Attempts_UserId ON Attempts(userId);
CREATE INDEX IX_Attempts_CourseId ON Attempts(courseId);
CREATE INDEX IX_Attempts_RegistrationId ON Attempts(registrationId);
CREATE INDEX IX_Users_Email ON Users(email);


