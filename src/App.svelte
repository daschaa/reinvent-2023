<script>
	import { onMount } from "svelte";
	import Youtube from "svelte-youtube-embed";
	import videos from '../res/videos.json';

	let filteredVideos = [...videos];
	let searchInput = "";
	let selectedTopics = [];
	let selectedLevels = [];

	let topics = [
		"DOP", "SEG", "BIZ", "ENT", "SEC", "SPT", "STG", "IMP", "ANT", "AIM",
		"SMB", "SAS", "WPS", "PEX", "NET", "MAE", "MFG", "LFS", "IOT", "IDE",
		"GDS", "GAM", "FWM", "FSI", "ENU", "CMP", "COM", "COP", "BWP", "BSI",
		"BOA", "SUP", "MKT", "ARC", "API", "AMZ", "AES", "ADM", "DAT", "BLC",
		"CEN", "HYB", "PRO", "XNT", "CON", "TLC", "SUS", "OPN", "PRT", "PEN",
		"NTA", "SVS", "ALX", "INO", "CPG", "HLC", "TNC", "NFX", "QTC", "RET",
		"ROB", "TRV", "EUC", "AUT", "GBL",
	];

	const filterVideos = () => {
		filteredVideos = videos.filter(video => {
			const searchTerm = searchInput.toLowerCase();
			const title = video.title.toLowerCase();
			const topicMatch = selectedTopics.length === 0 || selectedTopics.includes(getTopicFromTitle(video.title));
			const levelMatch = selectedLevels.length === 0 || selectedLevels.map(level => `${level / 100}`).includes(getLevelFromTitle(video.title));
			return title.includes(searchTerm) && topicMatch && levelMatch;
		});
	};

	const clearFilters = () => {
		searchInput = "";
		selectedTopics = [];
		selectedLevels = [];
		filteredVideos = [...videos];
	};

	const getTopicFromTitle = (title) => {
		const match = title.match(/\((\w{3})\d{3}\)/);
		console.log(title);
		return match ? match[1] : "";
	};

	const getLevelFromTitle = (title) => {
		const match = title.match(/\((\w{3})(\d{3})\)/);
		return match ? match[2].substring(0, 1) : "";
	};

	const getYoutubeVideoId = (url) => {
		const match = url.match(/[?&]v=([^#&?]{11})/);
		return match ? match[1] : "";
	};

	onMount(() => {
		filterVideos();
	});
</script>

<style>
	/* Add your styles here */

	main {
		display: flex;
		flex-direction: column;
	}

	.top-bar {
		padding: 20px;
		background-color: #333;
		color: #fff;
		display: flex;
		justify-content: space-between;
		width: 100%;
		z-index: 1;
		box-sizing: border-box;
	}

	input {
		padding: 8px;
		margin-right: 10px;
		border: 1px solid #ccc;
		border-radius: 4px;
	}

	button {
		padding: 8px;
		background-color: #4CAF50;
		color: #fff;
		border: none;
		border-radius: 4px;
		cursor: pointer;
	}

	.container {
		display: flex;
	}

	.sidebar {
		width: 200px;
		padding: 20px;
		background-color: #f4f4f4;
	}

	@media (max-width: 1250px) {
		.sidebar {
			display: none;
		}
	}

	.sidebar h3 {
		margin-bottom: 10px;
		font-size: 16px;
	}

	label {
		display: block;
		margin-bottom: 8px;
	}

	.main-content {
		padding: 20px;
		display: grid;
		grid-template-columns: repeat(auto-fill, minmax(300px, 1fr)); /* Updated to auto-fill */
		gap: 20px;
		flex-grow: 1;
	}

	.video-card {
		max-height: 300px;
		border: 1px solid #ddd;
		padding: 10px;
		border-radius: 4px;
		background-color: #fff;
	}

	/* Optional: Style the checkboxes */
	input[type="checkbox"] {
		margin-right: 5px;
	}

</style>

<main>
	<div class="top-bar">
		<input bind:value={searchInput} placeholder="Search for video titles" on:input={filterVideos} />
		<button on:click={clearFilters}>Clear Filters</button>
	</div>

	<div class="container">
		<div class="sidebar">
			<h3>Filter by Level</h3>
			{#each [100, 200, 300, 400] as level}
				<label>
					<input type="checkbox" bind:group={selectedLevels} value={level} on:change={filterVideos} />
					{level}
				</label>
			{/each}
			<h3>Filter by Topic</h3>
			{#each topics as topic}
				<label>
					<input type="checkbox" bind:group={selectedTopics} value={topic} on:change={filterVideos} />
					{topic}
				</label>
			{/each}
		</div>
		<div class="main-content">
			{#if filteredVideos.length > 0}
				{#each filteredVideos as video (video.url)}
					<div class="video-card">
						<Youtube id="{getYoutubeVideoId(video.url)}" />
						<h5>{video.title}</h5>
					</div>
				{/each}
			{:else}
				<p>No videos found.</p>
			{/if}
		</div>
	</div>
</main>
