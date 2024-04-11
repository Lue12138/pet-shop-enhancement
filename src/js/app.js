App = {
  web3Provider: null,
  contracts: {},

  init: async function() {
    // Load pets.
    $.getJSON('../pets.json', function(data) {
      App.petsData = data;
      var petsRow = $('#petsRow');
      var petTemplate = $('#petTemplate');

      for (i = 0; i < data.length; i ++) {
        petTemplate.find('.panel-title').text(data[i].name);
        petTemplate.find('img').attr('src', data[i].picture);
        petTemplate.find('.pet-breed').text(data[i].breed);
        petTemplate.find('.pet-age').text(data[i].age);
        petTemplate.find('.pet-location').text(data[i].location);
        petTemplate.find('.btn-adopt').attr('data-id', data[i].id);
        petTemplate.find(".btn-return").attr("data-id", data[i].id);
        petTemplate.find('.adoption-status').text(data[i].adopted);

        petsRow.append(petTemplate.html());
      }
    });

    return await App.initWeb3();
  },

  initWeb3: async function() {

    // Modern dapp browsers...
    if (window.ethereum) {
      App.web3Provider = window.ethereum;
      try {
        // Request account access
        await window.ethereum.enable();
      } catch (error) {
        // User denied account access...
        console.error("User denied account access")
      }
    }
    // Legacy dapp browsers...
    else if (window.web3) {
      App.web3Provider = window.web3.currentProvider;
    }
    // If no injected web3 instance is detected, fall back to Ganache
    else {
      App.web3Provider = new Web3.providers.HttpProvider('http://localhost:7545');
    }
    web3 = new Web3(App.web3Provider);

    return App.initContract();
  },

  initContract: function() {
    $.getJSON('Adoption.json', function(data) {
      // Get the necessary contract artifact file and instantiate it with truffle-contract
      var AdoptionArtifact = data;
      App.contracts.Adoption = TruffleContract(AdoptionArtifact);
    
      // Set the provider for our contract
      App.contracts.Adoption.setProvider(App.web3Provider);
    
      // Use our contract to retrieve and mark the adopted pets
      return App.markAdopted();
    });
    
    return App.bindEvents();
  },

  bindEvents: function() {
    $(document).on('click', '.btn-adopt', App.handleAdopt);
    $(document).on("click", ".btn-return", App.handleReturn);
  },

  markAdopted: function() {
    var adoptionInstance;
    // Abbreviate address for display
    function abbreviateAddress(address) {
      if (address.length <= 10) {
        return address;
      }
      return address.slice(0, 6) + '...' + address.slice(-4);
    }

    App.contracts.Adoption.deployed().then(function(instance) {
      adoptionInstance = instance;
    
      return adoptionInstance.getAdopters.call();
    }).then(function(adopters) {
      for (i = 0; i < adopters.length; i++) {
        if (adopters[i] !== '0x0000000000000000000000000000000000000000') {
          // change adopt status and buttons accordingly for adopted pets
          $('.panel-pet').eq(i).find('.btn-adopt').text('Success').attr('disabled', true);
          $(".panel-pet").eq(i).find(".btn-return").css("display", "inline-block");
          $('.panel-pet').eq(i).find('.adoption-status').text('Yes');
          $('.panel-pet').eq(i).find('.pet-owner').text(abbreviateAddress(adopters[i]));
          App.petsData[i].adopted = 'Yes'
        } else {
          $(".panel-pet").eq(i).find(".btn-adopt").text("Adopt").attr("disabled", false);
          $(".panel-pet").eq(i).find(".btn-return").css("display", "none");
          $('.panel-pet').eq(i).find('.adoption-status').text('No');
          $('.panel-pet').eq(i).find('.pet-owner').text('None');
          App.petsData[i].adopted = 'No'
        }
      }
      document.getElementById('most-adopted-breed').innerHTML = App.trackMostAdoptedBreed();
    }).catch(function(err) {
      console.log(err.message);
    });
  },

  // Function to track the most adopted breed
  trackMostAdoptedBreed: function() {
    var breedsCount = {};
    var mostAdoptedBreed = "";
    var maxCount = 0;

    // Count the occurrences of each breed
    for (var i = 0; i < App.petsData.length; i++) {
      if (App.petsData[i].adopted !== 'Yes') continue;
      var breed = App.petsData[i].breed;

      breedsCount[breed] = (breedsCount[breed] || 0) + 1;

      if (breedsCount[breed] > maxCount) {
        maxCount = breedsCount[breed];
        mostAdoptedBreed = breed;
      } else if (breedsCount[breed] === maxCount) {
        // multiple winners!
        if (!mostAdoptedBreed.includes(breed)) {
          mostAdoptedBreed += mostAdoptedBreed ? ', ' + breed : breed;
        }
      }
    }

    // If no pets are adopted, set a message to indicate this
    if (maxCount === 0) {
      return "There is currently no pet adopted :(";
    }

    return mostAdoptedBreed;
  },

  handleReturn: function (event) {
    event.preventDefault();

    var petId = parseInt($(event.target).data("id"));
    var adoptionInstance;
    web3.eth.getAccounts(function (error, accounts) {
      if (error) {
        console.log(error);
      }

      var account = accounts[0];

      App.contracts.Adoption.deployed()
        .then(function (instance) {
          adoptionInstance = instance;
          // Execute adopt as a transaction by sending account
          return adoptionInstance.returnPet(petId, { from: account });
        })
        .then(function (result) {
          return App.markAdopted();
        })
        .catch(function (err) {
          console.log(err.message);
        });
    });
  },
  
  handleAdopt: function(event) {
    event.preventDefault();

    var petId = parseInt($(event.target).data('id'));

    var adoptionInstance;

    web3.eth.getAccounts(function(error, accounts) {
      if (error) {
        console.log(error);
      }
    
      var account = accounts[0];
    
      App.contracts.Adoption.deployed().then(function(instance) {
        adoptionInstance = instance;
    
        // Execute adopt as a transaction by sending account
        return adoptionInstance.adopt(petId, {from: account});
      }).then(function(result) {
        return App.markAdopted();
      }).catch(function(err) {
        console.log(err.message);
      });
    });
  },
};

$(function() {
  $(window).load(function() {
    App.init();
  });
});

function filterChanged() {
  const adoptionStatus = document.getElementById('adoptionStatusDropdown').value;
  const selectedBreed = document.getElementById('breedDropdown').value;

  const pets = document.querySelectorAll('#petsRow .div-pet');

  pets.forEach(pet => {
    const adoptionStatusText = pet.querySelector('.adoption-status').textContent;
    const breedText = pet.querySelector('.pet-breed').textContent;

    let matchesFilter = true;

    if (adoptionStatus && (adoptionStatus === 'available' && adoptionStatusText === 'Yes' || adoptionStatus === 'adopted' && adoptionStatusText === 'No')) {
      matchesFilter = false;
    }
    if (selectedBreed && selectedBreed !== breedText) {
      matchesFilter = false;
    }

    pet.style.display = matchesFilter ? 'flex' : 'none';
  });
};
