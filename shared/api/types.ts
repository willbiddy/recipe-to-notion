import type { ProgressType } from "../constants.js";

/**
 * Response format from the server API.
 */
export type RecipeResponse =
	| {
			success: true;
			pageId: string;
			notionUrl: string;
	  }
	| {
			success: false;
			error: string;
			notionUrl?: string;
	  };

/**
 * Server-Sent Event types for recipe processing progress.
 */
export enum ServerProgressEventType {
	Progress = "progress",
	Complete = "complete",
	Error = "error",
}

/**
 * Progress event from server.
 */
export type ServerProgressEvent =
	| {
			type: ServerProgressEventType.Progress;
			message: string;
			progressType: ProgressType;
	  }
	| {
			type: ServerProgressEventType.Complete;
			success: true;
			pageId: string;
			notionUrl: string;
			recipe?: {
				name: string;
				author: string;
				ingredients: string[];
				instructions: string[];
			};
			tags?: {
				tags: string[];
				mealType: string;
				healthScore: number;
				totalTimeMinutes: number;
			};
	  }
	| {
			type: ServerProgressEventType.Error;
			success: false;
			error: string;
			notionUrl?: string;
	  };

/**
 * Callbacks for progress updates.
 */
export type ProgressCallbacks = {
	onProgress: (message: string) => void;
	onComplete: (data: {
		pageId: string;
		notionUrl: string;
		recipe: {
			name: string;
			author: string;
			ingredients: string[];
			instructions: string[];
		};
		tags: {
			tags: string[];
			mealType: string;
			healthScore: number;
			totalTimeMinutes: number;
		};
	}) => void;
	onError: (error: string, notionUrl?: string) => void;
};

import type { StorageAdapter } from "../storage.js";

/**
 * Options for saving a recipe.
 */
export type SaveRecipeOptions = {
	url: string;
	apiUrl: string;
	storage: StorageAdapter;
	callbacks: ProgressCallbacks;
};
